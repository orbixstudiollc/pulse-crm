// Discovery call to proposal. When a deal reaches "Proposal" (or on request),
// the AI drafts a proposal from the call notes, the contact's replies and the
// service catalog; the client reads it on a public page and accepts, asks for
// changes or declines there. Unanswered proposals get up to two follow-ups.
//
// The AI only picks services and writes the words: services outside the
// catalog are dropped, prices are clamped into each service's range and the
// Investment table is rebuilt from the checked prices, so a proposal never
// shows a price the catalog does not allow.

import { DATA_NOT_INSTRUCTIONS, readJsonObject, str, type AgencyWriter } from 'src/gtm/agency/ai';
import { createClientEmail } from 'src/gtm/agency/client-emails';
import { createTaskFor, randomToken, type Records } from 'src/gtm/agency/gql';
import { formatMoney, type AgencySettings } from 'src/gtm/agency/settings';
import type { ProposalStatus } from 'src/gtm/agency/values';

const DAY = 24 * 60 * 60 * 1000;
export const MAX_FOLLOW_UPS = 2;
export const FOLLOW_UP_UNVIEWED_DAYS = 3;
export const FOLLOW_UP_VIEWED_DAYS = 5;
export const MIN_TOKEN_LENGTH = 16;
const MAX_COMMENT = 2000;

// Deal stages in pipeline order; a proposal moves earlier deals to PROPOSAL.
const STAGE_ORDER = ['NEW', 'SCREENING', 'MEETING', 'PROPOSAL', 'CUSTOMER'];

// ---------------------------------------------------------------------------
// Rows

export type ServiceRow = {
  id: string;
  name: string | null;
  category: string | null;
  description: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  deliveryWeeks: number | null;
  deliverables: string | null;
};

export type ProposalRow = {
  id: string;
  name: string | null;
  status: ProposalStatus | null;
  summary: string | null;
  body: string | null;
  amount: number | null;
  services: string | null;
  publicToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  followUpsSent: number | null;
  lastFollowUpAt: string | null;
  clientComment: string | null;
  opportunityId: string | null;
  personId: string | null;
};

type OpportunityRow = {
  id: string;
  name: string | null;
  stage: string | null;
  amount: { amountMicros: number | null; currencyCode: string | null } | null;
  pointOfContactId: string | null;
  companyId: string | null;
};

type PersonRow = {
  id: string;
  name: { firstName: string | null; lastName: string | null } | null;
  emails: { primaryEmail: string | null } | null;
  jobTitle: string | null;
  companyId: string | null;
};

export type CompanyRow = { id: string; name: string | null; domainName: { primaryLinkUrl: string | null } | null };

type NoteTargetRow = { id: string; note: { id: string; title: string | null; bodyV2: { markdown: string | null } | null; createdAt: string | null } | null };
type InboxRow = { id: string; subject: string | null; snippet: string | null; aiSummary: string | null; createdAt: string | null };

export const SERVICE_SELECTION = {
  name: true,
  category: true,
  description: true,
  priceFrom: true,
  priceTo: true,
  deliveryWeeks: true,
  deliverables: true,
};

export const PROPOSAL_SELECTION = {
  name: true,
  status: true,
  summary: true,
  body: true,
  amount: true,
  services: true,
  publicToken: true,
  sentAt: true,
  viewedAt: true,
  respondedAt: true,
  followUpsSent: true,
  lastFollowUpAt: true,
  clientComment: true,
  opportunityId: true,
  personId: true,
};

const OPPORTUNITY_SELECTION = {
  name: true,
  stage: true,
  amount: { amountMicros: true, currencyCode: true },
  pointOfContactId: true,
  companyId: true,
};
const PERSON_SELECTION = {
  name: { firstName: true, lastName: true },
  emails: { primaryEmail: true },
  jobTitle: true,
  companyId: true,
};
const COMPANY_SELECTION = { name: true, domainName: { primaryLinkUrl: true } };

const fullName = (p: PersonRow | null) => [p?.name?.firstName, p?.name?.lastName].filter(Boolean).join(' ').trim();

// ---------------------------------------------------------------------------
// Services: the AI's picks checked against the catalog

export type ProposalService = { name: string; price: number | null; weeks: number | null };

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.-]/g, ''));
    return v.trim() && Number.isFinite(n) ? n : null;
  }
  return null;
};

// A price inside the service's range. Fixed price when there is no priceTo;
// null ("price to confirm") when the service has no price at all.
export const clampPrice = (service: Pick<ServiceRow, 'priceFrom' | 'priceTo'>, proposed: unknown): number | null => {
  const from = service.priceFrom ?? null;
  const to = service.priceTo ?? null;
  if (from === null && to === null) return null;
  if (to === null) return from;
  const min = from ?? 0;
  const max = Math.max(min, to);
  const n = toNumber(proposed);
  if (n === null) return from ?? max;
  return Math.min(max, Math.max(min, n));
};

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export const validateServices = (raw: unknown, catalog: ServiceRow[]): ProposalService[] => {
  if (!Array.isArray(raw)) return [];
  const byName = new Map(catalog.filter((s) => s.name?.trim()).map((s) => [key(s.name as string), s]));
  const seen = new Set<string>();
  const out: ProposalService[] = [];
  for (const item of raw) {
    const name = typeof item === 'string' ? item : (item as { name?: unknown } | null)?.name;
    if (typeof name !== 'string') continue;
    const service = byName.get(key(name));
    if (!service || seen.has(service.id)) continue;
    seen.add(service.id);
    out.push({
      name: (service.name as string).trim(),
      price: clampPrice(service, (item as { price?: unknown } | null)?.price),
      weeks: service.deliveryWeeks ?? null,
    });
  }
  return out;
};

export const totalAmount = (services: ProposalService[]): number | null => {
  const priced = services.filter((s) => s.price !== null);
  return priced.length ? priced.reduce((sum, s) => sum + (s.price as number), 0) : null;
};

export const servicesText = (services: ProposalService[]) =>
  services.map((s) => `${s.name} | ${s.price === null ? 'price to confirm' : s.price}`).join('\n');

export const investmentTable = (services: ProposalService[], currency: string): string => {
  if (!services.length) return '## Investment\n\nPricing to confirm together.';
  const rows = services.map((s) => `| ${s.name.replace(/\|/g, '/')} | ${s.price === null ? 'Price to confirm' : formatMoney(s.price, currency)} |`);
  const total = totalAmount(services);
  return ['## Investment', '', '| Service | Price |', '| --- | --- |', ...rows, ...(total !== null ? [`| **Total** | **${formatMoney(total, currency)}** |`] : [])].join('\n');
};

// Swaps whatever Investment section the AI wrote for the checked one: at the
// {{investment}} placeholder, else before "Next steps", else at the end.
export const withInvestment = (body: string, table: string): string => {
  const sections = body.split(/\n(?=#{1,3}\s)/);
  const kept = sections.filter((s) => !/^#{1,3}\s*(investment|pricing|budget)\b/i.test(s.trim()));
  let text = kept.join('\n').trim();
  if (/\{\{\s*investment\s*\}\}/i.test(text)) return text.replace(/\{\{\s*investment\s*\}\}/i, table);
  const next = text.search(/^#{1,3}\s*next steps/im);
  if (next >= 0) return `${text.slice(0, next).trimEnd()}\n\n${table}\n\n${text.slice(next)}`;
  text = text ? `${text}\n\n${table}` : table;
  return text;
};

// ---------------------------------------------------------------------------
// Links

export const proposalLink = (settings: Pick<AgencySettings, 'publicPagesUrl'>, token: string): string | null =>
  settings.publicPagesUrl ? `${settings.publicPagesUrl}/proposal?t=${encodeURIComponent(token)}` : null;

export const LINK_MISSING_LINE =
  '[The proposal link could not be built: set PUBLIC_PAGES_URL in the app settings, then add the link here before sending.]';

const withLink = (body: string, link: string | null, lead: string) => {
  const clean = body.replace(/\{\{[^}]*\}\}/g, '').trim();
  if (!link) return `${clean}\n\n${LINK_MISSING_LINE}`;
  return clean.includes(link) ? clean : `${clean}\n\n${lead} ${link}`;
};

// ---------------------------------------------------------------------------
// Drafting

export const PROPOSAL_SYSTEM = `You write project proposals for Orbix Studio, a design and development agency, after a discovery call.
Use only the deal, the call notes, the client's emails and the service catalog in the data.
Rules:
- Pick services only from the catalog, using their exact names. Pick only what the notes show the client needs.
- Price each service within its range (priceFrom to priceTo). When a service has no priceTo the price is fixed at priceFrom. When a service has no price, write "price to confirm" in the body and give price null.
- Never invent prices, clients, case studies, results or dates.
- body is markdown with these sections: ## Overview, ## Goals, ## Scope & deliverables, ## Timeline (from each service's deliveryWeeks), ## Investment (a table of the services and prices), ## Next steps.
- email is a short, warm note to the contact introducing the proposal. Do not include a link; it is added for you.
Reply with JSON only: {"title": string, "summary": string (2 sentences, for the team), "services": [{"name": string, "price": number|null}], "body": string, "email": {"subject": string, "body": string}}.
${DATA_NOT_INSTRUCTIONS}`;

export const FOLLOW_UP_SYSTEM = `You write short, friendly follow-up emails from Orbix Studio about a proposal the client has not answered yet.
3 to 5 sentences, no pressure, no fake urgency, one clear question. Do not include a link; it is added for you.
${DATA_NOT_INSTRUCTIONS}
Reply with JSON only: {"subject": string, "body": string}.`;

export type DraftResult = { ok: boolean; skipped?: string; error?: string; proposalId?: string; clientEmailId?: string };

const loadNotes = async (records: Records, opportunityId: string, personId: string | null) => {
  const filter = personId
    ? { or: [{ targetOpportunityId: { eq: opportunityId } }, { targetPersonId: { eq: personId } }] }
    : { targetOpportunityId: { eq: opportunityId } };
  const rows = await records.findMany<NoteTargetRow>(
    'noteTargets',
    filter,
    { note: { id: true, title: true, bodyV2: { markdown: true }, createdAt: true } },
    50,
  );
  const byId = new Map<string, NonNullable<NoteTargetRow['note']>>();
  for (const r of rows) if (r.note?.id) byId.set(r.note.id, r.note);
  return [...byId.values()]
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    .slice(0, 10);
};

const loadContact = async (records: Records, deal: OpportunityRow): Promise<PersonRow | null> => {
  if (deal.pointOfContactId) {
    const p = await records.findOne<PersonRow>('people', deal.pointOfContactId, PERSON_SELECTION);
    if (p) return p;
  }
  if (!deal.companyId) return null;
  const [first] = await records.findMany<PersonRow>('people', { companyId: { eq: deal.companyId } }, PERSON_SELECTION, 1);
  return first ?? null;
};

const catalogLine = (s: ServiceRow) =>
  JSON.stringify({
    name: s.name,
    category: s.category,
    description: s.description?.slice(0, 600) ?? null,
    priceFrom: s.priceFrom,
    priceTo: s.priceTo,
    deliveryWeeks: s.deliveryWeeks,
    deliverables: s.deliverables?.slice(0, 600) ?? null,
  });

export const draftProposal = async ({
  records,
  writer,
  settings,
  opportunityId,
  notes,
  force = false,
}: {
  records: Records;
  writer: AgencyWriter;
  settings: AgencySettings;
  opportunityId: string;
  notes?: string | null;
  force?: boolean;
  now?: Date;
}): Promise<DraftResult> => {
  const deal = await records.findOne<OpportunityRow>('opportunities', opportunityId, OPPORTUNITY_SELECTION);
  if (!deal) return { ok: false, error: 'Deal not found' };

  if (!force) {
    const existing = await records.findMany<{ id: string; status: string | null }>('proposals', { opportunityId: { eq: opportunityId } }, { status: true }, 20);
    const open = existing.find((p) => p.status !== 'DECLINED');
    if (open) return { ok: true, skipped: 'The deal already has a proposal', proposalId: open.id };
  }

  const contact = await loadContact(records, deal);
  const companyId = deal.companyId ?? contact?.companyId ?? null;
  const company = companyId ? await records.findOne<CompanyRow>('companies', companyId, COMPANY_SELECTION) : null;
  const callNotes = await loadNotes(records, opportunityId, contact?.id ?? null);
  const inbox = contact
    ? await records.findMany<InboxRow>('inboxItems', { personId: { eq: contact.id } }, { subject: true, snippet: true, aiSummary: true, createdAt: true }, 10)
    : [];
  const catalog = await records.findMany<ServiceRow>('agencyServices', { isActive: { eq: true } }, SERVICE_SELECTION, 100);
  if (!catalog.length) return { ok: false, error: 'No active services in the catalog' };

  const companyName = company?.name?.trim() || deal.name?.trim() || 'the client';
  const prompt = [
    '<data>',
    `Deal: ${deal.name ?? ''}`,
    `Company: ${companyName}${company?.domainName?.primaryLinkUrl ? ` (${company.domainName.primaryLinkUrl})` : ''}`,
    `Contact: ${fullName(contact) || 'unknown'}${contact?.jobTitle ? `, ${contact.jobTitle}` : ''}`,
    `Currency: ${settings.currency}`,
    notes?.trim() ? `\nNotes from the team:\n${notes.trim().slice(0, 4000)}` : '',
    '\nCall notes (newest first):',
    ...(callNotes.length
      ? callNotes.map((n) => `### ${n.title ?? 'Note'} (${n.createdAt?.slice(0, 10) ?? ''})\n${(n.bodyV2?.markdown ?? '').slice(0, 3000)}`)
      : ['(none)']),
    '\nTheir emails:',
    ...(inbox.length ? inbox.map((i) => `- ${i.subject ?? ''}: ${i.aiSummary ?? i.snippet ?? ''}`.slice(0, 500)) : ['(none)']),
    '\nService catalog (one JSON object per line):',
    ...catalog.map(catalogLine),
    '</data>',
  ]
    .filter((l) => l !== '')
    .join('\n');

  const reply = readJsonObject(await writer.write(PROPOSAL_SYSTEM, prompt, 3000));
  const body = str(reply?.body, 20000);
  if (!reply || !body) return { ok: false, error: 'The AI did not return a proposal' };

  const services = validateServices(reply.services, catalog);
  const amount = totalAmount(services);
  const token = randomToken();
  const title = str(reply.title, 200) ?? `Proposal for ${companyName}`;

  const proposalId = await records.create('proposal', {
    name: title,
    status: 'DRAFT',
    summary: str(reply.summary, 1000),
    body: withInvestment(body, investmentTable(services, settings.currency)),
    amount,
    services: servicesText(services),
    publicToken: token,
    followUpsSent: 0,
    opportunityId,
    personId: contact?.id ?? null,
  });

  const email = (reply.email ?? {}) as Record<string, unknown>;
  const firstName = contact?.name?.firstName?.trim();
  const emailBody =
    str(email.body, 4000) ??
    `Hi${firstName ? ` ${firstName}` : ''},\n\nThanks again for the call. Here is our proposal for ${companyName}, based on what we discussed.`;
  const clientEmailId = await createClientEmail(
    records,
    {
      kind: 'PROPOSAL',
      subject: str(email.subject, 200) ?? title,
      body: withLink(emailBody, proposalLink(settings, token), 'You can read the proposal and reply here:'),
      toEmail: contact?.emails?.primaryEmail?.trim() || null,
      personId: contact?.id ?? null,
      proposalId,
    },
    settings.autoSend,
  );

  // After the proposal exists, so the stage trigger finds it and skips.
  const stageIndex = STAGE_ORDER.indexOf(deal.stage ?? '');
  const patch: Record<string, unknown> = {};
  if (stageIndex >= 0 && stageIndex < STAGE_ORDER.indexOf('PROPOSAL')) patch.stage = 'PROPOSAL';
  if (amount !== null && !deal.amount?.amountMicros) patch.amount = { amountMicros: Math.round(amount * 1_000_000), currencyCode: settings.currency };
  await records.update('opportunity', opportunityId, patch);

  return { ok: true, proposalId, clientEmailId };
};

// ---------------------------------------------------------------------------
// Client responses

export type ProposalAction = 'ACCEPT' | 'CHANGES' | 'DECLINE';

export const parseAction = (raw: unknown): ProposalAction | null => {
  const t = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (t === 'ACCEPT' || t === 'ACCEPTED') return 'ACCEPT';
  if (t === 'CHANGES' || t === 'CHANGES_REQUESTED' || t === 'REQUEST_CHANGES') return 'CHANGES';
  if (t === 'DECLINE' || t === 'DECLINED') return 'DECLINE';
  return null;
};

export const isValidToken = (token: unknown): token is string =>
  typeof token === 'string' && token.length >= MIN_TOKEN_LENGTH && token.length <= 200 && /^[A-Za-z0-9_-]+$/.test(token);

export const findProposalByToken = async (records: Records, token: unknown): Promise<ProposalRow | null> => {
  if (!isValidToken(token)) return null;
  const [row] = await records.findMany<ProposalRow>('proposals', { publicToken: { eq: token } }, PROPOSAL_SELECTION, 1);
  return row && row.publicToken === token ? row : null;
};

export const proposalCompany = async (records: Records, proposal: ProposalRow): Promise<CompanyRow | null> => {
  let companyId: string | null = null;
  if (proposal.opportunityId) companyId = (await records.findOne<OpportunityRow>('opportunities', proposal.opportunityId, { companyId: true }))?.companyId ?? null;
  if (!companyId && proposal.personId) companyId = (await records.findOne<PersonRow>('people', proposal.personId, { companyId: true }))?.companyId ?? null;
  return companyId ? records.findOne<CompanyRow>('companies', companyId, COMPANY_SELECTION) : null;
};

// A view counts once the proposal has gone out (the team previewing a draft
// is not the client reading it).
export const recordProposalView = async ({ records, token, now = new Date() }: { records: Records; token: unknown; now?: Date }) => {
  const proposal = await findProposalByToken(records, token);
  if (!proposal) return { ok: false as const, error: 'Not found' };
  if (proposal.status === 'DRAFT') return { ok: true as const, proposal };
  const patch: Record<string, unknown> = {};
  if (!proposal.viewedAt) patch.viewedAt = now.toISOString();
  if (proposal.status === 'SENT') patch.status = 'VIEWED';
  await records.update('proposal', proposal.id, patch);
  return { ok: true as const, proposal: { ...proposal, ...patch } as ProposalRow };
};

export type RespondResult = { ok: boolean; error?: string; already?: boolean; status?: ProposalStatus; taskId?: string; proposal?: ProposalRow };

const STATUS_FOR: Record<ProposalAction, ProposalStatus> = { ACCEPT: 'ACCEPTED', CHANGES: 'CHANGES_REQUESTED', DECLINE: 'DECLINED' };

export const respondToProposal = async ({
  records,
  token,
  action,
  comment,
  now = new Date(),
}: {
  records: Records;
  token: unknown;
  action: unknown;
  comment?: unknown;
  now?: Date;
}): Promise<RespondResult> => {
  const proposal = await findProposalByToken(records, token);
  if (!proposal) return { ok: false, error: 'Not found' };
  const act = parseAction(action);
  if (!act) return { ok: false, error: 'Unknown action', proposal };
  if (proposal.status === 'DRAFT') return { ok: false, error: 'This proposal has not been sent yet', proposal };
  // Accepted and declined are final; a second click changes nothing.
  if (proposal.status === 'ACCEPTED' || proposal.status === 'DECLINED') return { ok: true, already: true, status: proposal.status, proposal };

  const status = STATUS_FOR[act];
  const text = typeof comment === 'string' ? comment.trim().slice(0, MAX_COMMENT) : '';
  const at = now.toISOString();
  await records.update('proposal', proposal.id, {
    status,
    respondedAt: at,
    ...(proposal.viewedAt ? {} : { viewedAt: at }),
    ...(text ? { clientComment: text } : {}),
  });

  const company = await proposalCompany(records, proposal);
  const who = company?.name?.trim() || proposal.name?.trim() || 'The client';
  // Accepting wins the deal, which starts the kickoff.
  if (act === 'ACCEPT' && proposal.opportunityId) await records.update('opportunity', proposal.opportunityId, { stage: 'CUSTOMER' });

  const title = act === 'ACCEPT' ? `${who} accepted the proposal` : act === 'CHANGES' ? `Revise proposal for ${who}` : `${who} declined the proposal`;
  const taskId = await createTaskFor(
    records,
    { title, body: text ? `Client comment:\n\n${text}` : null, dueAt: new Date(now.getTime() + (act === 'CHANGES' ? 1 : 0) * DAY).toISOString() },
    { targetOpportunityId: proposal.opportunityId, targetPersonId: proposal.personId },
  );
  return { ok: true, status, taskId, proposal: { ...proposal, status, respondedAt: at } };
};

// Form posts (application/x-www-form-urlencoded) and JSON bodies alike.
export const parseRespondBody = (event: { body?: unknown; rawBody?: string; isBase64Encoded?: boolean }): Record<string, string> => {
  let raw: unknown = event.body;
  if ((raw === null || raw === undefined) && typeof event.rawBody === 'string') {
    raw = event.isBase64Encoded ? Buffer.from(event.rawBody, 'base64').toString('utf8') : event.rawBody;
  }
  if (typeof raw === 'string') {
    if (raw.length > 20_000) return {};
    const t = raw.trim();
    if (t.startsWith('{')) {
      try {
        raw = JSON.parse(t);
      } catch {
        return {};
      }
    } else {
      return Object.fromEntries(new URLSearchParams(t));
    }
  }
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string') out[k] = v;
  return out;
};

// ---------------------------------------------------------------------------
// Follow-ups

export type FollowUpResult = { ok: boolean; checked: number; drafted: number; skipped: number; failed: number; errors: string[] };

const later = (...dates: (string | null | undefined)[]) =>
  Math.max(...dates.map((d) => (d ? new Date(d).getTime() : NaN)).filter((n) => Number.isFinite(n)), -Infinity);

// Due 3 days after sending (or the last follow-up) when unread, 5 days after
// the first view (or the last follow-up) when read.
export const followUpDue = (p: Pick<ProposalRow, 'status' | 'sentAt' | 'viewedAt' | 'respondedAt' | 'followUpsSent' | 'lastFollowUpAt'>, now: Date): boolean => {
  if (p.status !== 'SENT' && p.status !== 'VIEWED') return false;
  if (p.respondedAt || (p.followUpsSent ?? 0) >= MAX_FOLLOW_UPS) return false;
  const viewed = Boolean(p.viewedAt);
  const since = viewed ? later(p.viewedAt, p.lastFollowUpAt) : later(p.sentAt, p.lastFollowUpAt);
  if (!Number.isFinite(since)) return false;
  return now.getTime() - since >= (viewed ? FOLLOW_UP_VIEWED_DAYS : FOLLOW_UP_UNVIEWED_DAYS) * DAY;
};

export const proposalFollowUps = async ({
  records,
  writer,
  settings,
  now = new Date(),
}: {
  records: Records;
  writer: AgencyWriter;
  settings: AgencySettings;
  now?: Date;
}): Promise<FollowUpResult> => {
  const result: FollowUpResult = { ok: true, checked: 0, drafted: 0, skipped: 0, failed: 0, errors: [] };
  const open = await records.findMany<ProposalRow>(
    'proposals',
    { and: [{ status: { in: ['SENT', 'VIEWED'] } }, { respondedAt: { is: 'NULL' } }] },
    PROPOSAL_SELECTION,
    200,
  );
  for (const p of open) {
    result.checked++;
    if (!followUpDue(p, now) || !p.publicToken) {
      result.skipped++;
      continue;
    }
    try {
      const pending = await records.findMany<{ id: string }>(
        'clientEmails',
        { and: [{ proposalId: { eq: p.id } }, { kind: { eq: 'PROPOSAL_FOLLOW_UP' } }, { status: { in: ['DRAFT', 'APPROVED'] } }] },
        {},
        1,
      );
      if (pending.length) {
        result.skipped++;
        continue;
      }
      const person = p.personId ? await records.findOne<PersonRow>('people', p.personId, PERSON_SELECTION) : null;
      const company = await proposalCompany(records, p);
      const second = (p.followUpsSent ?? 0) >= 1;
      const prompt = [
        second
          ? 'This is the second and last follow-up. Take a different angle from the first: offer a quick call to adjust scope or budget, or ask whether the timing is wrong.'
          : `This is the first follow-up. ${p.viewedAt ? 'They opened the proposal but have not replied: ask if anything is unclear or worth adjusting.' : 'They have not opened it yet: a light check that it reached them.'}`,
        '<data>',
        `Proposal: ${p.name ?? ''}`,
        `Summary: ${p.summary ?? ''}`,
        `Company: ${company?.name ?? ''}`,
        `Contact first name: ${person?.name?.firstName ?? ''}`,
        `Sent: ${p.sentAt?.slice(0, 10) ?? ''}${p.viewedAt ? `, first viewed ${p.viewedAt.slice(0, 10)}` : ', not viewed yet'}`,
        '</data>',
      ].join('\n');
      const reply = readJsonObject(await writer.write(FOLLOW_UP_SYSTEM, prompt, 600));
      const body = str(reply?.body, 3000);
      if (!body) throw new Error('The AI did not return a follow-up');
      await createClientEmail(
        records,
        {
          kind: 'PROPOSAL_FOLLOW_UP',
          subject: str(reply?.subject, 200) ?? `Re: ${p.name ?? 'our proposal'}`,
          body: withLink(body, proposalLink(settings, p.publicToken), 'The proposal is here:'),
          toEmail: person?.emails?.primaryEmail?.trim() || null,
          personId: p.personId,
          proposalId: p.id,
        },
        settings.autoSend,
      );
      result.drafted++;
    } catch (error) {
      result.failed++;
      result.errors.push(`${p.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
};

// ---------------------------------------------------------------------------
// Public page

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Inline markdown on already-escaped text: bold, italics, code and http(s) links.
const inline = (escaped: string) =>
  escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>');

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

// A small markdown subset to HTML. Everything is escaped first, so HTML in the
// body shows as text and never runs.
export const markdownToHtml = (markdown: string): string => {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      i++;
      continue;
    }
    const heading = t.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = Math.min(4, heading[1].length + 1);
      out.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
      i++;
      continue;
    }
    if (t.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      const isSep = (r: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(r.trim());
      const head = rows.length > 1 && isSep(rows[1]) ? cells(rows[0]) : null;
      const body = (head ? rows.slice(2) : rows).filter((r) => !isSep(r));
      out.push(
        `<div class="table"><table>${head ? `<thead><tr>${head.map((c) => `<th>${inline(escapeHtml(c))}</th>`).join('')}</tr></thead>` : ''}<tbody>${body
          .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(escapeHtml(c))}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (/^([-*+]|\d+[.)])\s+/.test(t)) {
      const ordered = /^\d/.test(t);
      const items: string[] = [];
      while (i < lines.length && /^([-*+]|\d+[.)])\s+/.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^([-*+]|\d+[.)])\s+/, ''));
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${inline(escapeHtml(it))}</li>`).join('')}</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||([-*+]|\d+[.)])\s)/.test(lines[i].trim())) para.push(lines[i++].trim());
    out.push(`<p>${para.map((p) => inline(escapeHtml(p))).join('<br>')}</p>`);
  }
  return out.join('\n');
};

const CSS = `*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#1d2433;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{background:#fff;border-bottom:1px solid #e4e7ec;padding:16px}header .in{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.2px}
.logo{width:28px;height:28px;border-radius:8px;background:#4f46e5;color:#fff;display:grid;place-items:center;font-size:15px}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}.card{background:#fff;border:1px solid #e4e7ec;border-radius:14px;padding:24px;margin-bottom:16px}
h1{font-size:26px;line-height:1.25;margin:0 0 6px}h2{font-size:20px;margin:28px 0 8px}h3,h4{font-size:17px;margin:20px 0 6px}.muted{color:#667085;font-size:14px}
.total{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}.total strong{font-size:24px}
.table{overflow-x:auto}table{border-collapse:collapse;width:100%;margin:8px 0}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e4e7ec}th{font-size:14px;color:#475467}
ul,ol{padding-left:22px}a{color:#4f46e5}code{background:#f2f4f7;padding:1px 4px;border-radius:4px}
textarea{width:100%;min-height:90px;padding:10px;border:1px solid #d0d5dd;border-radius:10px;font:inherit;margin:8px 0 12px}
.actions{display:flex;flex-wrap:wrap;gap:10px}button{font:inherit;font-weight:600;border-radius:10px;padding:12px 18px;cursor:pointer;border:1px solid #d0d5dd;background:#fff;color:#1d2433;flex:1 1 160px}
button.primary{background:#4f46e5;border-color:#4f46e5;color:#fff}.notice{background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:12px 14px;margin-bottom:16px}`;

const shell = (title: string, content: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)}</title><style>${CSS}</style></head>
<body><header><div class="in"><span class="logo">O</span>Orbix Studio</div></header><main>${content}</main></body></html>`;

const STATUS_NOTE: Partial<Record<ProposalStatus, string>> = {
  ACCEPTED: 'You accepted this proposal. Thank you, we will be in touch about the kickoff.',
  DECLINED: 'You declined this proposal. Thank you for letting us know.',
  CHANGES_REQUESTED: 'You asked for changes. We are revising the proposal; you can still accept or decline this version below.',
};

export const renderProposalPage = (
  proposal: Pick<ProposalRow, 'name' | 'status' | 'summary' | 'body' | 'amount' | 'publicToken'>,
  company: Pick<CompanyRow, 'name'> | null,
  settings: Pick<AgencySettings, 'publicPagesUrl' | 'currency'>,
): string => {
  const title = proposal.name?.trim() || 'Proposal';
  const final = proposal.status === 'ACCEPTED' || proposal.status === 'DECLINED';
  const draft = proposal.status === 'DRAFT';
  const action = settings.publicPagesUrl ? `${settings.publicPagesUrl}/proposal/respond` : 'proposal/respond';
  const note = draft ? 'Preview: this proposal has not been sent yet.' : proposal.status ? STATUS_NOTE[proposal.status] : undefined;
  const amount = formatMoney(proposal.amount, settings.currency);
  const form =
    final || draft || !proposal.publicToken
      ? ''
      : `<form class="card" method="post" action="${escapeHtml(action)}">
<h2 style="margin-top:0">Your answer</h2>
<input type="hidden" name="t" value="${escapeHtml(proposal.publicToken)}">
<label for="comment" class="muted">Comment (optional)</label>
<textarea id="comment" name="comment" maxlength="${MAX_COMMENT}" placeholder="Anything you would like us to know or change"></textarea>
<div class="actions"><button class="primary" type="submit" name="action" value="ACCEPT">Accept proposal</button><button type="submit" name="action" value="CHANGES">Request changes</button><button type="submit" name="action" value="DECLINE">Decline</button></div>
</form>`;
  return shell(
    title,
    `${note ? `<div class="notice">${escapeHtml(note)}</div>` : ''}
<div class="card"><div class="muted">${escapeHtml(company?.name?.trim() ? `Prepared for ${company.name.trim()}` : 'Proposal')}</div><h1>${escapeHtml(title)}</h1>
${proposal.summary ? `<p>${escapeHtml(proposal.summary)}</p>` : ''}
${amount ? `<div class="total"><span class="muted">Total investment</span><strong>${escapeHtml(amount)}</strong></div>` : ''}</div>
<article class="card">${markdownToHtml(proposal.body ?? '')}</article>
${form}`,
  );
};

const THANKS: Record<ProposalStatus, { title: string; text: string }> = {
  ACCEPTED: { title: 'Thank you!', text: 'Your acceptance is recorded. We will be in touch shortly to plan the kickoff.' },
  CHANGES_REQUESTED: { title: 'Thanks for the feedback', text: 'We will revise the proposal and get back to you soon.' },
  DECLINED: { title: 'Thanks for letting us know', text: 'Your answer is recorded. If anything changes, we would be glad to talk again.' },
  DRAFT: { title: 'Not available yet', text: 'This proposal has not been sent yet.' },
  SENT: { title: 'Thank you', text: 'Your answer is recorded.' },
  VIEWED: { title: 'Thank you', text: 'Your answer is recorded.' },
};

export const renderThankYouPage = (status: ProposalStatus): string => {
  const t = THANKS[status];
  return shell(t.title, `<div class="card"><h1>${escapeHtml(t.title)}</h1><p>${escapeHtml(t.text)}</p></div>`);
};

export const renderMessagePage = (title: string, text: string): string =>
  shell(title, `<div class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p></div>`);

export const renderNotFoundPage = () =>
  renderMessagePage('Proposal not found', 'This link is not valid any more. Please ask us for a new one.');

// What the two public routes answer, kept here so it can be tested.
export type PageResponse = { status: number; html: string };

export const proposalPageResponse = async ({
  records,
  settings,
  token,
  now = new Date(),
}: {
  records: Records;
  settings: AgencySettings;
  token: unknown;
  now?: Date;
}): Promise<PageResponse> => {
  const viewed = await recordProposalView({ records, token, now });
  if (!viewed.ok) return { status: 404, html: renderNotFoundPage() };
  const company = await proposalCompany(records, viewed.proposal);
  return { status: 200, html: renderProposalPage(viewed.proposal, company, settings) };
};

export const proposalRespondResponse = async ({
  records,
  fields,
  now = new Date(),
}: {
  records: Records;
  fields: Record<string, string>;
  now?: Date;
}): Promise<PageResponse> => {
  const res = await respondToProposal({ records, token: fields.t, action: fields.action, comment: fields.comment, now });
  if (res.ok && res.status) return { status: 200, html: renderThankYouPage(res.status) };
  if (res.error === 'Not found') return { status: 404, html: renderNotFoundPage() };
  return { status: 400, html: renderMessagePage('Something is missing', res.error ?? 'Please go back and try again.') };
};
