// One qualifier pass over Pending people:
//   website research + company classification (once per company),
//   title classification (cached per distinct title),
//   suppression, ICP location/size, email verification for leads that pass
//   everything else, then the gates: Qualified, Review or Rejected.
// The bulk model classifies everything; the review model (when set) takes a
// second look at the borderline ones.

import { titleKey, type Classifier, type CompanyVerdict, type IcpBrief, type TitleVerdict } from 'src/gtm/qualify/classify';
import { gate, icpFit, suppressionReason, worthVerifying, type GateResult } from 'src/gtm/qualify/gate';
import type { QualifyCompany, QualifyPerson, QualifyStore } from 'src/gtm/qualify/store';
import { classify, QUALIFICATION_VERSION, REJECT_BELOW, type EmailStatus } from 'src/gtm/qualify/values';
import { researchWebsite, type PageReader } from 'src/gtm/qualify/website';

export type EmailVerifier = (
  person: QualifyPerson,
  company: QualifyCompany | null,
) => Promise<{ email: string | null; verified: boolean; prospeoPersonId?: string | null } | null>;

export type QualifyDeps = {
  store: QualifyStore;
  bulk: Classifier;
  review?: Classifier | null;
  readPage: PageReader;
  verifyEmail?: EmailVerifier | null;
  threshold: number;
  dailyVerifications: number;
  now?: Date;
  // Stop starting new work after this many ms (the function has a hard timeout).
  budgetMs?: number;
  peopleLimit?: number;
  companiesLimit?: number;
};

export type QualifyResult = {
  ok: true;
  icp: string | null;
  companiesClassified: number;
  peopleProcessed: number;
  qualified: number;
  review: number;
  rejected: number;
  verified: number;
  waiting: number;
  errors: string[];
};

const TITLE_CACHE_PREFIX = `qualify:title:${QUALIFICATION_VERSION}:`;
const verificationsKey = (day: string) => `qualify:verifications:${day}`;

const isBorderline = (confidence: number, threshold: number) => confidence >= REJECT_BELOW && confidence < threshold;

const today = (now: Date) => now.toISOString().slice(0, 10);

const fullName = (p: QualifyPerson) => [p.firstName, p.lastName].filter(Boolean).join(' ').trim();

const pct = (v: number | null | undefined) => (v === null || v === undefined ? 'n/a' : `${Math.round(v * 100)}%`);

async function classifyCompany(
  deps: QualifyDeps,
  icp: IcpBrief,
  company: QualifyCompany,
): Promise<Record<string, unknown>> {
  const research = company.domain ? await researchWebsite(company.domain, deps.readPage) : null;
  const ask = (c: Classifier) => c.company(icp, company, research?.text ?? null);

  let verdict: CompanyVerdict | null = await ask(deps.bulk);
  let label = deps.bulk.label;
  if (verdict && deps.review && isBorderline(verdict.confidence, deps.threshold)) {
    const second = await ask(deps.review);
    if (second) {
      verdict = second;
      label = deps.review.label;
    }
  }

  const sources = research ? research.pages.map((p) => `- ${p.url}`).join('\n') : company.domain ? '- website could not be read' : '- no website on record';
  const base: Record<string, unknown> = {
    websiteResearchAt: today(deps.now ?? new Date()),
    classificationModel: label,
  };
  if (!verdict) {
    return { ...base, agencyClassification: 'REVIEW', agencyConfidence: null, classificationReason: 'The model gave no usable answer; check by hand.' };
  }
  const markdown = [verdict.reason, verdict.evidence ? `\n**Evidence**\n${verdict.evidence}` : '', `\n**Sources**\n${sources}`].filter(Boolean).join('\n');
  return {
    ...base,
    agencyClassification: classify(verdict.confidence, deps.threshold),
    agencyConfidence: verdict.confidence,
    agencyType: verdict.agencyType,
    classificationReason: verdict.reason,
    websiteResearch: { markdown },
  };
}

async function classifyTitles(
  deps: QualifyDeps,
  icp: IcpBrief,
  titles: string[],
): Promise<Map<string, TitleVerdict & { model: string }>> {
  const out = new Map<string, TitleVerdict & { model: string }>();
  const missing: string[] = [];
  for (const t of titles) {
    const cached = await deps.store.kvGet<TitleVerdict & { model: string }>(TITLE_CACHE_PREFIX + titleKey(t));
    if (cached) out.set(titleKey(t), cached);
    else missing.push(t);
  }
  const run = async (c: Classifier, list: string[]) => {
    if (list.length === 0) return;
    (await c.titles(icp, list)).forEach((v, j) => {
      if (v) out.set(titleKey(list[j]), { ...v, model: c.label });
    });
  };
  await run(deps.bulk, missing);
  if (deps.review) {
    const borderline = missing.filter((t) => {
      const v = out.get(titleKey(t));
      return v && isBorderline(v.confidence, deps.threshold);
    });
    await run(deps.review, borderline);
  }
  for (const t of missing) {
    const v = out.get(titleKey(t));
    if (v) await deps.store.kvSet(TITLE_CACHE_PREFIX + titleKey(t), v);
  }
  return out;
}

export const summaryFor = (
  result: GateResult,
  company: QualifyCompany | null,
  title: (TitleVerdict & { model: string }) | null,
  emailStatus: EmailStatus,
): string => {
  const head = result.status === 'QUALIFIED' ? 'Qualified' : result.status === 'REVIEW' ? 'Needs review' : 'Rejected';
  const parts = [
    `${head}${result.score !== null ? ` (score ${result.score})` : ''}.`,
    company ? `Company: ${company.agencyType ? `${company.agencyType}, ` : ''}${pct(company.agencyConfidence)}${company.classificationReason ? `. ${company.classificationReason}` : ''}` : 'No company.',
    title ? `Title: ${title.category ?? 'n/a'}, ${pct(title.confidence)}${title.reason ? ` (${title.reason})` : ''}.` : 'Title not classified.',
    `Email: ${emailStatus.toLowerCase()}.`,
  ];
  if (result.notes.length) parts.push(`Why: ${result.notes.join('; ')}.`);
  return parts.join(' ').slice(0, 2000);
};

export const qualifyPending = async (deps: QualifyDeps): Promise<QualifyResult | { ok: false; error: string }> => {
  const now = deps.now ?? new Date();
  const started = Date.now();
  const outOfTime = () => Date.now() - started > (deps.budgetMs ?? 240_000);
  const { store } = deps;

  const icp = await store.activeIcp();
  if (!icp) return { ok: false, error: 'No active ICP. Turn on the ICP you want leads qualified against (ICP > Active).' };

  const result: QualifyResult = {
    ok: true,
    icp: icp.name ?? icp.id,
    companiesClassified: 0,
    peopleProcessed: 0,
    qualified: 0,
    review: 0,
    rejected: 0,
    verified: 0,
    waiting: 0,
    errors: [],
  };

  const people = await store.pendingPeople(deps.peopleLimit ?? 60);
  if (people.length === 0) return result;

  // 1. Companies: research and classify the ones not done yet.
  const companyIds = [...new Set(people.map((p) => p.companyId).filter(Boolean) as string[])];
  const companies = new Map((await store.companies(companyIds)).map((c) => [c.id, c]));
  let budget = deps.companiesLimit ?? 12;
  for (const company of companies.values()) {
    if (company.researchedAt) continue;
    if (budget-- <= 0 || outOfTime()) break;
    const update = await classifyCompany(deps, icp, company);
    try {
      await store.updateCompany(company.id, update);
    } catch {
      // Rich text formats differ between Twenty versions; keep the classification either way.
      const plain = { ...update };
      delete plain.websiteResearch;
      await store.updateCompany(company.id, plain);
    }
    Object.assign(company, {
      researchedAt: update.websiteResearchAt as string,
      agencyConfidence: (update.agencyConfidence as number | null) ?? null,
      agencyType: (update.agencyType as string | null) ?? null,
      classificationReason: (update.classificationReason as string | null) ?? null,
    });
    result.companiesClassified++;
  }

  const ready = people.filter((p) => !p.companyId || companies.get(p.companyId)?.researchedAt || !companies.has(p.companyId));
  result.waiting = people.length - ready.length;
  if (ready.length === 0) return result;

  // 2. Titles, once per distinct title.
  const titles = [...new Map(ready.filter((p) => p.jobTitle?.trim()).map((p) => [titleKey(p.jobTitle!), p.jobTitle!.trim()])).values()];
  const titleVerdicts = await classifyTitles(deps, icp, titles);

  // 3. Suppression inputs.
  const [blocked, ownDomains, enrollments] = await Promise.all([
    store.blockedHandles(),
    store.ownDomains(),
    store.enrollmentCounts(ready.map((p) => p.id)),
  ]);
  const dayKey = verificationsKey(today(now));
  let verificationsUsed = (await store.kvGet<number>(dayKey)) ?? 0;
  let verifyEmail = deps.verifyEmail ?? null;

  // 4. Gate each person.
  for (const person of ready) {
    if (outOfTime()) break;
    try {
      const company = person.companyId ? companies.get(person.companyId) ?? null : null;
      const title = person.jobTitle?.trim() ? titleVerdicts.get(titleKey(person.jobTitle)) ?? null : null;
      let emailStatus: EmailStatus = person.emailStatus ?? (person.email ? 'UNVERIFIED' : 'UNKNOWN');
      const suppressed = suppressionReason({ email: person.email, leadStatus: person.leadStatus, emailStatus, blockedHandles: blocked, ownDomains });
      const holds = (enrollments.get(person.id) ?? 0) > 0 ? ['Already in a sequence'] : [];
      const fit = icpFit(icp, { location: person.location || company?.location, headcount: company?.headcount });
      const input = {
        companyConfidence: company?.agencyConfidence ?? null,
        titleConfidence: title?.confidence ?? null,
        emailStatus,
        suppressedReason: suppressed,
        fit,
        threshold: deps.threshold,
        holds,
      };

      const update: Record<string, unknown> = {};
      if (verifyEmail && verificationsUsed < deps.dailyVerifications && worthVerifying(input)) {
        verificationsUsed++;
        await store.kvSet(dayKey, verificationsUsed);
        try {
          const found = await verifyEmail(person, company);
          if (found?.prospeoPersonId && !person.prospeoPersonId) update.prospeoPersonId = found.prospeoPersonId;
          if (found?.verified && found.email) {
            const changed = found.email !== person.email?.toLowerCase();
            const owner = changed ? await store.personIdByEmail(found.email) : null;
            if (owner && owner !== person.id) {
              emailStatus = 'UNKNOWN';
              holds.push('Verified email belongs to another person in the CRM');
            } else {
              emailStatus = 'VERIFIED';
              if (changed) update.emails = { primaryEmail: found.email };
              result.verified++;
            }
          } else {
            emailStatus = 'UNKNOWN';
          }
        } catch (error) {
          // Out of credits, bad key, provider down: stop verifying this run and say why.
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Email verification stopped: ${message}`);
          verifyEmail = null;
          holds.push(`Email check failed: ${message}`);
        }
      }

      const verdict = gate({ ...input, emailStatus, holds });
      Object.assign(update, {
        qualificationStatus: verdict.status,
        qualificationNotes: verdict.notes.join('\n') || null,
        qualificationVersion: QUALIFICATION_VERSION,
        emailVerificationStatus: emailStatus,
        titleClassification: title ? classify(title.confidence, deps.threshold) : null,
        titleConfidence: title?.confidence ?? null,
        titleCategory: title?.category ?? null,
        titleClassificationReason: title ? `${title.reason ?? ''}${title.reason ? ' ' : ''}(${title.model})`.trim() : person.jobTitle ? 'Not classified' : 'No job title',
        aiSummary: summaryFor(verdict, company, title, emailStatus),
      });
      if (verdict.score !== null) {
        update.leadScore = verdict.score;
        update.icpGrade = verdict.grade;
      }
      if (verdict.status === 'QUALIFIED' && person.leadStatus !== 'CUSTOMER') update.leadStatus = 'QUALIFIED';
      if (verdict.status === 'REJECTED' && (!person.leadStatus || person.leadStatus === 'NEW')) update.leadStatus = 'DISQUALIFIED';

      await store.updatePerson(person.id, update);
      result.peopleProcessed++;
      if (verdict.status === 'QUALIFIED') result.qualified++;
      else if (verdict.status === 'REVIEW') result.review++;
      else result.rejected++;
    } catch (error) {
      result.errors.push(`${fullName(person) || person.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
};
