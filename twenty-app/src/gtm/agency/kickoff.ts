// Won deal to kickoff. When a deal reaches Customer, Pulse sets up the work
// so nothing waits on someone remembering to do it:
//
//   projects   one per service sold (from the accepted proposal, or the one
//              catalog service the deal is named after), else one for the deal
//   tasks      each service's kickoff checklist ("+N" = due N days after
//              kickoff), or a generic one
//   contact    lead status Customer
//   invoice    one DRAFT deposit invoice (DEPOSIT_PERCENT of the deal), which
//              someone approves before send-invoice puts it in Stripe
//   welcome    a WELCOME client email with the intake form and booking links
//
// Runs once per deal: a deal that already has a project is skipped.

import { DATA_NOT_INSTRUCTIONS, readJsonObject, str, type AgencyWriter } from 'src/gtm/agency/ai';
import { createClientEmail } from 'src/gtm/agency/client-emails';
import { createTaskFor, type Records } from 'src/gtm/agency/gql';
import { formatMoney, type AgencySettings } from 'src/gtm/agency/settings';

const DAY = 86_400_000;

export type KickoffSettings = Pick<
  AgencySettings,
  'depositPercent' | 'invoiceDueDays' | 'currency' | 'intakeFormUrl' | 'bookingLink' | 'autoSend'
>;

type OpportunityRow = {
  id: string;
  name: string | null;
  stage: string | null;
  amount: { amountMicros: number | string | null; currencyCode: string | null } | null;
  pointOfContactId: string | null;
  companyId: string | null;
};

type ProposalRow = { id: string; status: string | null; services: string | null; amount: number | null; personId: string | null };

export type ServiceRow = {
  id: string;
  name: string | null;
  priceFrom: number | null;
  deliveryWeeks: number | null;
  taskChecklist: string | null;
};

type PersonRow = {
  id: string;
  name: { firstName: string | null; lastName: string | null } | null;
  emails: { primaryEmail: string | null } | null;
};

export type KickoffResult = {
  ok: boolean;
  skipped?: string;
  projectIds?: string[];
  taskIds?: string[];
  invoiceId?: string | null;
  welcomeEmailId?: string | null;
};

// ---- small pure helpers -----------------------------------------------------

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const round2 = (n: number) => Math.round(n * 100) / 100;

// "$5,000.50" / "5000" / "5 000 €" -> 5000.5; null when there is no number.
export const parseMoney = (raw: string | null | undefined): number | null => {
  const cleaned = (raw ?? '').replace(/[^\d.,-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

// Proposal "services": one "Service name | price" per line.
export const parseProposalServices = (text: string | null | undefined): { name: string; price: number | null }[] =>
  (text ?? '')
    .split('\n')
    .map((line) => line.replace(/^[\s*•-]+/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const [name, price] = line.split('|').map((p) => p.trim());
      return { name: name ?? '', price: parseMoney(price) };
    })
    .filter((s) => s.name);

// Kickoff checklist: one task per line, optional trailing "+N" (days after kickoff).
export const parseChecklist = (text: string | null | undefined, defaultDays = 1): { title: string; days: number }[] =>
  (text ?? '')
    .split('\n')
    .map((line) => line.replace(/^[\s*•-]+|\[\s?\]\s*/g, '').trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*\+(\d{1,3})$/);
      return m ? { title: m[1].trim(), days: Number(m[2]) } : { title: line, days: defaultDays };
    })
    .filter((t) => t.title);

// Used when a project has no service checklist; spread over the delivery time.
export const fallbackChecklist = (totalDays: number) => [
  { title: 'Kickoff call', days: 2 },
  { title: 'Collect brand assets & access', days: 3 },
  { title: 'First draft', days: Math.max(4, Math.round(totalDays * 0.5)) },
  { title: 'Client review', days: Math.max(5, Math.round(totalDays * 0.75)) },
  { title: 'Final delivery', days: Math.max(6, totalDays) },
];

// Splits `total` over weights in cents, the last line taking the rounding.
export const splitAmount = (total: number, weights: number[]): number[] => {
  if (weights.length === 0) return [];
  const usable = weights.every((w) => w > 0) ? weights : weights.map(() => 1);
  const sum = usable.reduce((a, b) => a + b, 0);
  const parts = usable.map((w) => round2((total * w) / sum));
  parts[parts.length - 1] = round2(total - parts.slice(0, -1).reduce((a, b) => a + b, 0));
  return parts;
};

const INVOICE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const invoiceNumber = (now: Date, random: () => number = defaultRandom) => {
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += INVOICE_CHARS[Math.floor(random() * INVOICE_CHARS.length) % INVOICE_CHARS.length];
  return `INV-${isoDate(now).replace(/-/g, '')}-${suffix}`;
};
function defaultRandom() {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

export const personName = (p: PersonRow | null) => [p?.name?.firstName, p?.name?.lastName].filter(Boolean).join(' ').trim();

// Formats an invoice line the way the clientInvoice field describes it.
export const lineItemText = (description: string, qty: number, rate: number) =>
  `${description.replace(/\|/g, '/')} | ${qty} | ${rate.toFixed(2)}`;

// ---- planning --------------------------------------------------------------

type PlannedService = { service: ServiceRow | null; label: string; price: number | null };

// Services sold on this deal: the accepted proposal's lines that match the
// catalog by name, else the one catalog service the deal is named after.
export const pickServices = (
  dealName: string,
  proposal: ProposalRow | null,
  catalog: ServiceRow[],
): PlannedService[] => {
  const byName = (n: string) => catalog.find((s) => s.name?.trim().toLowerCase() === n.trim().toLowerCase()) ?? null;
  if (proposal) {
    const matched = parseProposalServices(proposal.services)
      .map((line) => ({ line, service: byName(line.name) }))
      .filter((m) => m.service)
      .map(({ line, service }) => ({ service, label: service!.name!.trim(), price: line.price ?? service!.priceFrom ?? null }));
    if (matched.length > 0) return matched;
  }
  const deal = dealName.toLowerCase();
  const named = catalog.filter((s) => s.name?.trim() && deal.includes(s.name.trim().toLowerCase()));
  if (named.length === 1) return [{ service: named[0], label: named[0].name!.trim(), price: null }];
  return [];
};

// ---- the run ---------------------------------------------------------------

const WELCOME_INSTRUCTIONS = `You write the welcome email a small creative agency sends a client the day they sign.
Warm, short (under 140 words), plain text, no markdown, no emojis. Thank them, say what happens next in one or two sentences.
If an intake form link is given, ask them to fill it in before the kickoff call. If a booking link is given, ask them to pick a time for the kickoff call with it.
If a deposit invoice is mentioned, say it comes separately from Stripe with a secure card payment link. Never put amounts in the email.
Reply with JSON only: {"subject": "...", "body": "..."}.
${DATA_NOT_INSTRUCTIONS}`;

export const kickoffWonDeal = async ({
  records,
  writer,
  settings,
  opportunityId,
  now = new Date(),
  random,
}: {
  records: Records;
  writer: AgencyWriter | null;
  settings: KickoffSettings;
  opportunityId: string;
  now?: Date;
  random?: () => number;
}): Promise<KickoffResult> => {
  const existing = await records.findMany<{ id: string }>('clientProjects', { opportunityId: { eq: opportunityId } }, {}, 1);
  if (existing.length > 0) return { ok: true, skipped: 'Deal already has a project' };

  const deal = await records.findOne<OpportunityRow>('opportunities', opportunityId, {
    name: true,
    stage: true,
    amount: { amountMicros: true, currencyCode: true },
    pointOfContactId: true,
    companyId: true,
  });
  if (!deal) return { ok: true, skipped: 'Deal not found' };

  const [proposal] = await records.findMany<ProposalRow>(
    'proposals',
    { and: [{ opportunityId: { eq: opportunityId } }, { status: { eq: 'ACCEPTED' } }] },
    { status: true, services: true, amount: true, personId: true },
    1,
    [{ updatedAt: 'DescNullsLast' }],
  );
  const catalog = await records.findMany<ServiceRow>(
    'agencyServices',
    {},
    { name: true, priceFrom: true, deliveryWeeks: true, taskChecklist: true },
    200,
  );
  const company = deal.companyId
    ? await records.findOne<{ id: string; name: string | null }>('companies', deal.companyId, { name: true })
    : null;
  const personId = deal.pointOfContactId ?? proposal?.personId ?? null;
  const person = personId
    ? await records.findOne<PersonRow>('people', personId, {
        name: { firstName: true, lastName: true },
        emails: { primaryEmail: true },
      })
    : null;

  const dealName = deal.name?.trim() || 'New project';
  const clientName = company?.name?.trim() || personName(person) || dealName;
  const dealAmount = Number(deal.amount?.amountMicros ?? 0) / 1e6;
  const services = pickServices(dealName, proposal ?? null, catalog);
  const start = isoDate(now);

  // Projects
  const planned: PlannedService[] = services.length > 0 ? services : [{ service: null, label: dealName, price: null }];
  const projects: { id: string; plan: PlannedService; days: number }[] = [];
  for (const plan of planned) {
    const weeks = plan.service?.deliveryWeeks ?? null;
    const days = weeks && weeks > 0 ? Math.round(weeks * 7) : 28;
    const name = plan.service
      ? company?.name?.trim() ? `${company.name.trim()} – ${plan.label}` : plan.label
      : company?.name?.trim() && !dealName.toLowerCase().includes(company.name.trim().toLowerCase())
        ? `${company.name.trim()} – ${dealName}`
        : dealName;
    const value = plan.service ? (services.length === 1 && plan.price === null && dealAmount > 0 ? dealAmount : plan.price) : dealAmount || null;
    const id = await records.create('clientProject', {
      name,
      status: 'KICKOFF',
      health: 'ON_TRACK',
      startDate: start,
      dueDate: weeks && weeks > 0 ? isoDate(addDays(now, days)) : null,
      value: value ?? null,
      companyId: deal.companyId ?? null,
      opportunityId,
      personId,
      serviceId: plan.service?.id ?? null,
    });
    projects.push({ id, plan, days });
  }

  // Kickoff tasks
  const taskIds: string[] = [];
  for (const p of projects) {
    const checklist = parseChecklist(p.plan.service?.taskChecklist);
    const tasks = checklist.length > 0 ? checklist : fallbackChecklist(p.days);
    for (const t of tasks) {
      taskIds.push(
        await createTaskFor(
          records,
          { title: projects.length > 1 ? `${t.title} (${p.plan.label})` : t.title, dueAt: addDays(now, t.days).toISOString() },
          { targetClientProjectId: p.id },
        ),
      );
    }
  }

  if (personId) await records.update('person', personId, { leadStatus: 'CUSTOMER' });

  // Deposit invoice
  const total = proposal?.amount && proposal.amount > 0 ? proposal.amount : dealAmount;
  let invoiceId: string | null = null;
  if (!(total > 0)) {
    taskIds.push(
      await createTaskFor(
        records,
        {
          title: `Set the deal amount to invoice ${clientName}`,
          body: 'The deal has no amount and no accepted proposal with one, so no deposit invoice was drafted. Add an invoice under Invoices once the price is set.',
          dueAt: addDays(now, 1).toISOString(),
        },
        { targetOpportunityId: opportunityId, targetClientProjectId: projects[0]?.id },
      ),
    );
  } else {
    const pct = settings.depositPercent;
    const deposit = round2((total * pct) / 100);
    const suffix = pct >= 100 ? '' : ` – ${pct}% deposit`;
    const rates = splitAmount(deposit, planned.map((p) => p.price ?? 0));
    const lineItems = planned.map((p, i) => lineItemText(`${p.label}${suffix}`, 1, rates[i])).join('\n');
    const name = invoiceNumber(now, random);
    invoiceId = await records.create('clientInvoice', {
      name,
      status: 'DRAFT',
      amount: deposit,
      lineItems,
      dueDate: isoDate(addDays(now, settings.invoiceDueDays)),
      remindersDrafted: 0,
      companyId: deal.companyId ?? null,
      projectId: projects[0]?.id ?? null,
      personId,
    });
    taskIds.push(
      await createTaskFor(
        records,
        {
          title: `Approve the deposit invoice for ${clientName}`,
          body: `${name}: ${formatMoney(deposit, settings.currency)} (${pct}% of ${formatMoney(total, settings.currency)}). Check the line items, then set Status to Approved: Pulse creates it in Stripe, which emails ${person?.emails?.primaryEmail || 'the client'} a payment link.`,
          dueAt: addDays(now, 1).toISOString(),
        },
        { targetClientInvoiceId: invoiceId, targetPersonId: personId },
      ),
    );
  }

  // Welcome email
  const welcome = await draftWelcome(writer, {
    firstName: person?.name?.firstName?.trim() || null,
    company: company?.name?.trim() || null,
    services: planned.map((p) => p.label),
    intakeFormUrl: settings.intakeFormUrl,
    bookingLink: settings.bookingLink,
    depositInvoice: Boolean(invoiceId),
  });
  const welcomeEmailId = await createClientEmail(
    records,
    {
      kind: 'WELCOME',
      subject: welcome.subject,
      body: welcome.body,
      toEmail: person?.emails?.primaryEmail?.trim() || null,
      personId,
      projectId: projects[0]?.id ?? null,
    },
    settings.autoSend,
  );

  return { ok: true, projectIds: projects.map((p) => p.id), taskIds, invoiceId, welcomeEmailId };
};

type WelcomeFacts = {
  firstName: string | null;
  company: string | null;
  services: string[];
  intakeFormUrl: string | null;
  bookingLink: string | null;
  depositInvoice: boolean;
};

// The AI's draft, with the links checked in; a plain template if it fails.
export const draftWelcome = async (writer: AgencyWriter | null, f: WelcomeFacts): Promise<{ subject: string; body: string }> => {
  let draft: { subject: string; body: string } | null = null;
  if (writer) {
    const facts = [
      `Client first name: ${f.firstName ?? 'unknown'}`,
      `Company: ${f.company ?? 'unknown'}`,
      `Services: ${f.services.join(', ')}`,
      `Intake form link: ${f.intakeFormUrl ?? 'none'}`,
      `Kickoff call booking link: ${f.bookingLink ?? 'none'}`,
      `Deposit invoice: ${f.depositInvoice ? 'yes, sent separately from Stripe' : 'none'}`,
    ].join('\n');
    try {
      const o = readJsonObject(await writer.write(WELCOME_INSTRUCTIONS, `<data>\n${facts}\n</data>`, 800));
      const subject = str(o?.subject, 200);
      const body = str(o?.body, 4000);
      if (subject && body) draft = { subject, body };
    } catch {
      draft = null;
    }
  }
  draft ??= welcomeTemplate(f);
  // Links are the point of the email; add any the AI left out.
  const missing = [
    f.intakeFormUrl && !draft.body.includes(f.intakeFormUrl) ? `Intake form: ${f.intakeFormUrl}` : null,
    f.bookingLink && !draft.body.includes(f.bookingLink) ? `Book the kickoff call: ${f.bookingLink}` : null,
  ].filter(Boolean);
  return missing.length ? { ...draft, body: `${draft.body.trim()}\n\n${missing.join('\n')}` } : draft;
};

export const welcomeTemplate = (f: WelcomeFacts) => {
  const steps = [
    f.intakeFormUrl ? `First, please fill in this short intake form so we start with everything we need: ${f.intakeFormUrl}` : null,
    f.bookingLink ? `Then pick a time for our kickoff call here: ${f.bookingLink}` : null,
    f.depositInvoice ? 'The deposit invoice comes separately from Stripe, with a secure link to pay by card.' : null,
  ].filter(Boolean);
  return {
    subject: `Welcome aboard${f.company ? `, ${f.company}` : ''}!`,
    body: [
      `Hi ${f.firstName ?? 'there'},`,
      `Thank you for choosing us for ${f.services.join(' and ') || 'this project'}. We are excited to get started.`,
      ...steps,
      'Talk soon!',
    ].join('\n\n'),
  };
};
