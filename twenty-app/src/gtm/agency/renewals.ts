// Renewals, upsells and referral asks: the follow-on work after a project.
//
//   On delivery      deliveredAt is stamped and an UPSELL email is drafted for
//                    the service's "Next service" from the catalog (or, if it
//                    has none, the closest active service from another
//                    category the client has not bought yet)
//   Daily            RENEWAL draft 14 days before a renewal date (once per 30
//                    days); REFERRAL ask 14+ days after delivery, never for an
//                    AT_RISK project; and the upsell for delivered projects the
//                    delivery trigger missed (7+ days, none drafted)
//
// Every email is a clientEmail draft (or auto-approved), written by the AI
// from CRM facts only; prices come from the catalog, never the model.

import { draftEmail, DAY, isoDay, loadContact, PROJECT_SELECTION, recentClientEmails, type ProjectRow } from 'src/gtm/agency/client-updates';
import type { AgencyWriter } from 'src/gtm/agency/ai';
import { createClientEmail, type NewClientEmail } from 'src/gtm/agency/client-emails';
import type { Records } from 'src/gtm/agency/gql';
import { formatMoney, type AgencySettings } from 'src/gtm/agency/settings';
import type { ClientEmailKind } from 'src/gtm/agency/values';

export const RENEWAL_WINDOW_DAYS = 14;
export const RENEWAL_DEDUPE_DAYS = 30;
export const REFERRAL_AFTER_DAYS = 14;
export const UPSELL_CATCH_UP_DAYS = 7;

export type ServiceRow = {
  id: string;
  name: string | null;
  category: string | null;
  description: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  nextService: string | null;
  isActive: boolean | null;
};

const SERVICE_SELECTION = { name: true, category: true, description: true, priceFrom: true, priceTo: true, nextService: true, isActive: true };

const norm = (s: string | null | undefined) => s?.trim().toLowerCase() ?? '';
const words = (s: string | null | undefined) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 3));

// What to suggest after `current`: its "Next service" when that is an active
// catalog entry, else the active service from another category that shares
// the most words with it (ties: cheaper first). Services the client already
// bought are left out. Null means there is nothing worth suggesting.
export const pickUpsellService = (current: ServiceRow | null, catalog: ServiceRow[], alreadyBought: Set<string> = new Set()): ServiceRow | null => {
  const active = catalog.filter((s) => s.isActive !== false && s.name?.trim() && s.id !== current?.id && !alreadyBought.has(s.id));
  if (current?.nextService?.trim()) {
    const next = active.find((s) => norm(s.name) === norm(current.nextService));
    if (next) return next;
  }
  const others = current?.category ? active.filter((s) => s.category !== current.category) : active;
  if (others.length === 0) return null;
  const mine = words(`${current?.name ?? ''} ${current?.description ?? ''}`);
  const score = (s: ServiceRow) => [...words(`${s.name} ${s.description ?? ''}`)].filter((w) => mine.has(w)).length;
  return [...others].sort((a, b) => score(b) - score(a) || (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity))[0];
};

export const priceRange = (s: Pick<ServiceRow, 'priceFrom' | 'priceTo'>, currency: string) => {
  const from = formatMoney(s.priceFrom, currency);
  const to = formatMoney(s.priceTo, currency);
  if (from && to && s.priceTo !== s.priceFrom) return `${from} to ${to}`;
  return from || to || null;
};

const SHARED_STYLE = `Keep it short (under 150 words), warm and plain, no hard sell. Use only facts in the data; never invent prices, results, dates or work. Address the contact by first name if known. Sign off as "The team".`;

export const UPSELL_INSTRUCTIONS = `You write a short follow-up email from an agency to a client whose project was just delivered, suggesting one next service.
Thank them for the project, say in one or two sentences why the suggested service is a natural next step (from its description), mention the price range only as given, and offer a short call (with the booking link if one is given). ${SHARED_STYLE}`;

export const RENEWAL_INSTRUCTIONS = `You write a short email from an agency to a client whose retainer or project renews soon.
Mention the renewal date, ask whether they want to continue as is or change the scope, and offer a quick call to plan the next period. ${SHARED_STYLE}`;

export const REFERRAL_INSTRUCTIONS = `You write a short email from an agency to a happy client a couple of weeks after their project was delivered.
Ask for one of two easy things: an introduction to someone who could use similar help, or a short review/testimonial. Make it easy to say no. ${SHARED_STYLE}`;

type Context = { records: Records; writer: AgencyWriter; settings: AgencySettings; now: Date };

const draftFor = async (
  { records, writer, settings }: Context,
  project: ProjectRow,
  kind: ClientEmailKind,
  instructions: string,
  facts: Record<string, unknown>,
): Promise<'drafted' | 'no-contact' | 'no-draft'> => {
  const contact = await loadContact(records, project);
  if (!contact) return 'no-contact';
  const draft = await draftEmail(writer, instructions, {
    project: project.name,
    contact: { firstName: contact.firstName, company: contact.company },
    bookingLink: settings.bookingLink,
    ...facts,
  });
  if (!draft) return 'no-draft';
  const email: NewClientEmail = { kind, ...draft, toEmail: contact.email, personId: contact.id, projectId: project.id };
  await createClientEmail(records, email, settings.autoSend);
  return 'drafted';
};

export type UpsellOutcome = { ok: boolean; drafted?: boolean; skipped?: string; serviceName?: string; error?: string };

const runUpsell = async (ctx: Context, project: ProjectRow): Promise<UpsellOutcome> => {
  const { records, settings, now } = ctx;
  if (project.upsellDraftedAt) return { ok: true, skipped: 'Upsell already drafted' };
  const current = project.serviceId ? await records.findOne<ServiceRow>('agencyServices', project.serviceId, SERVICE_SELECTION) : null;
  const catalog = await records.findMany<ServiceRow>('agencyServices', { isActive: { eq: true } }, SERVICE_SELECTION, 200);
  const bought = project.companyId
    ? await records.findMany<{ serviceId: string | null }>('clientProjects', { companyId: { eq: project.companyId } }, { serviceId: true }, 200)
    : [];
  const next = pickUpsellService(current, catalog, new Set(bought.map((p) => p.serviceId).filter((id): id is string => Boolean(id))));
  if (!next) return { ok: true, skipped: 'No service to suggest' };

  const outcome = await draftFor(ctx, project, 'UPSELL', UPSELL_INSTRUCTIONS, {
    deliveredService: current?.name ?? null,
    suggestedService: { name: next.name, description: next.description, priceRange: priceRange(next, settings.currency) },
  });
  if (outcome === 'no-contact') return { ok: true, skipped: 'No client contact' };
  if (outcome === 'no-draft') return { ok: false, error: 'The AI reply had no subject or body' };
  await records.update('clientProject', project.id, { upsellDraftedAt: now.toISOString() });
  return { ok: true, drafted: true, serviceName: next.name ?? undefined };
};

export const onProjectDelivered = async ({
  records,
  writer,
  settings,
  projectId,
  now = new Date(),
}: {
  records: Records;
  writer: AgencyWriter;
  settings: AgencySettings;
  projectId: string;
  now?: Date;
}): Promise<UpsellOutcome> => {
  const project = await records.findOne<ProjectRow>('clientProjects', projectId, PROJECT_SELECTION);
  if (!project) return { ok: true, skipped: 'Project not found' };
  if (!project.deliveredAt) {
    await records.update('clientProject', projectId, { deliveredAt: now.toISOString() });
    project.deliveredAt = now.toISOString();
  }
  return runUpsell({ records, writer, settings, now }, project);
};

export type RenewalsResult = {
  ok: boolean;
  renewals: number;
  referrals: number;
  upsells: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export const dailyRenewals = async ({
  records,
  writer,
  settings,
  now = new Date(),
}: {
  records: Records;
  writer: AgencyWriter;
  settings: AgencySettings;
  now?: Date;
}): Promise<RenewalsResult> => {
  const ctx: Context = { records, writer, settings, now };
  const result: RenewalsResult = { ok: true, renewals: 0, referrals: 0, upsells: 0, skipped: 0, failed: 0, errors: [] };
  const attempt = async (project: ProjectRow, run: () => Promise<'drafted' | 'skipped'>, counter: 'renewals' | 'referrals' | 'upsells') => {
    try {
      if ((await run()) === 'drafted') result[counter] += 1;
      else result.skipped += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${project.name ?? project.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const fail = (project: ProjectRow, error: string): never => {
    throw new Error(error || `Could not draft for ${project.name ?? project.id}`);
  };

  // (a) Renewals coming up in the next 14 days.
  const renewing = await records.findMany<ProjectRow>(
    'clientProjects',
    { and: [{ renewalDate: { gte: isoDay(now) } }, { renewalDate: { lte: isoDay(new Date(now.getTime() + RENEWAL_WINDOW_DAYS * DAY)) } }] },
    PROJECT_SELECTION,
    200,
  );
  for (const project of renewing) {
    await attempt(
      project,
      async () => {
        const since = new Date(now.getTime() - RENEWAL_DEDUPE_DAYS * DAY);
        if ((await recentClientEmails(records, project.id, 'RENEWAL', since)).length > 0) return 'skipped';
        const service = project.serviceId ? await records.findOne<ServiceRow>('agencyServices', project.serviceId, SERVICE_SELECTION) : null;
        const out = await draftFor(ctx, project, 'RENEWAL', RENEWAL_INSTRUCTIONS, {
          renewalDate: project.renewalDate,
          service: service?.name ?? null,
          currentValue: formatMoney(project.value, settings.currency) || null,
        });
        if (out === 'no-draft') fail(project, 'The AI reply had no subject or body');
        return out === 'drafted' ? 'drafted' : 'skipped';
      },
      'renewals',
    );
  }

  const delivered = await records.findMany<ProjectRow>(
    'clientProjects',
    { and: [{ status: { eq: 'DELIVERED' } }, { deliveredAt: { is: 'NOT_NULL' } }] },
    PROJECT_SELECTION,
    200,
  );
  const deliveredDaysAgo = (p: ProjectRow) => (now.getTime() - new Date(p.deliveredAt ?? now).getTime()) / DAY;

  // (b) Referral asks, 14+ days after delivery, not for projects at risk.
  for (const project of delivered) {
    if (project.referralDraftedAt || project.health === 'AT_RISK' || deliveredDaysAgo(project) < REFERRAL_AFTER_DAYS) continue;
    await attempt(
      project,
      async () => {
        const service = project.serviceId ? await records.findOne<ServiceRow>('agencyServices', project.serviceId, SERVICE_SELECTION) : null;
        const out = await draftFor(ctx, project, 'REFERRAL', REFERRAL_INSTRUCTIONS, {
          deliveredOn: project.deliveredAt?.slice(0, 10),
          service: service?.name ?? null,
        });
        if (out === 'no-draft') fail(project, 'The AI reply had no subject or body');
        if (out !== 'drafted') return 'skipped';
        await records.update('clientProject', project.id, { referralDraftedAt: now.toISOString() });
        return 'drafted';
      },
      'referrals',
    );
  }

  // (c) Upsells the delivery trigger missed.
  for (const project of delivered) {
    if (project.upsellDraftedAt || deliveredDaysAgo(project) < UPSELL_CATCH_UP_DAYS) continue;
    await attempt(
      project,
      async () => {
        const out = await runUpsell(ctx, project);
        if (!out.ok) fail(project, out.error ?? '');
        return out.drafted ? 'drafted' : 'skipped';
      },
      'upsells',
    );
  }

  result.ok = result.failed === 0;
  return result;
};
