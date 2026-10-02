import type { IpCompany } from 'src/insights/ip-company';
import type { VisitorEnrichStatus } from 'src/insights/visitor-values';

// Turns website visitors into leads, a batch at a time:
// 1. the company: from the visitor's work email, else an IP lookup;
// 2. our own mailboxes' domains are marked as our team and skipped;
// 3. the Company record is found or created and linked to the visit;
// 4. Prospeo adds up to N people at that company who match the ICP (each
//    company at most once per cooldown, within a daily cap);
// 5. new leads, and visitors who filled a form, go into the website-visitor
//    sequence when one exists.

export type PendingVisit = {
  id: string;
  ipAddress: string | null;
  companyDomain: string | null;
  companyName: string | null;
  personId: string | null;
  intentScore: number | null;
};

export type VisitPatch = Partial<{
  enrichStatus: VisitorEnrichStatus;
  companyName: string | null;
  companyDomain: string | null;
  companyId: string | null;
  city: string | null;
  country: string | null;
  leadsAdded: number;
}>;

export type VisitorEnrichConfig = {
  // People to add per visiting company; 0 turns lead finding off.
  leadsPerCompany: number;
  // Most new leads per day across all companies (Prospeo credits).
  dailyLeadCap: number;
  // Days before the same company can bring in new leads again.
  companyCooldownDays: number;
  batchSize: number;
};

export const DEFAULT_VISITOR_ENRICH_CONFIG: VisitorEnrichConfig = {
  leadsPerCompany: 3,
  dailyLeadCap: 20,
  companyCooldownDays: 30,
  batchSize: 25,
};

export type VisitorEnrichDeps = {
  listPending(limit: number): Promise<PendingVisit[]>;
  updateVisit(id: string, patch: VisitPatch): Promise<void>;
  // Null when no IPinfo token is set.
  lookupIp: ((ip: string) => Promise<IpCompany>) | null;
  ownDomains(): Promise<Set<string>>;
  findOrCreateCompany(company: { name: string | null; domain: string }): Promise<string>;
  // Adds up to `max` ICP people at the domain as leads; returns their ids.
  findLeads: ((domain: string, companyId: string, max: number) => Promise<string[]>) | null;
  // Enrolls people in the website-visitor sequence; returns how many went in.
  enroll(personIds: string[]): Promise<number>;
  getCompanyCooldown(domain: string): Promise<string | null>;
  setCompanyCooldown(domain: string, until: string): Promise<void>;
  getLeadsToday(day: string): Promise<number>;
  setLeadsToday(day: string, count: number): Promise<void>;
  config: VisitorEnrichConfig;
  now: Date;
  log?: (message: string) => void;
};

export type VisitorEnrichSummary = {
  visits: number;
  matched: number;
  noMatch: number;
  ownTeam: number;
  leadsAdded: number;
  enrolled: number;
  waitingForIpToken: number;
  errors: { visitId: string; error: string }[];
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const domainOf = (value: string) => value.toLowerCase().replace(/^www\./, '');

export const enrichWebsiteVisitors = async (deps: VisitorEnrichDeps): Promise<VisitorEnrichSummary> => {
  const { config, now } = deps;
  const summary: VisitorEnrichSummary = { visits: 0, matched: 0, noMatch: 0, ownTeam: 0, leadsAdded: 0, enrolled: 0, waitingForIpToken: 0, errors: [] };
  // Warmest visitors first, so the daily cap goes to them.
  const visits = [...(await deps.listPending(config.batchSize))].sort((a, b) => (b.intentScore ?? 0) - (a.intentScore ?? 0));
  if (visits.length === 0) return summary;

  const own = await deps.ownDomains();
  const day = now.toISOString().slice(0, 10);
  let leadsToday = await deps.getLeadsToday(day);
  const toEnroll: string[] = [];
  // Companies handled in this run, so two visitors from one company cost once.
  const doneThisRun = new Set<string>();

  for (const visit of visits) {
    try {
      let domain = visit.companyDomain ? domainOf(visit.companyDomain) : null;
      let name = visit.companyName;
      const patch: VisitPatch = {};

      if (!domain && visit.ipAddress) {
        if (!deps.lookupIp) {
          summary.waitingForIpToken++;
          // Form fills still count without the lookup.
          if (visit.personId) {
            toEnroll.push(visit.personId);
            await deps.updateVisit(visit.id, { enrichStatus: 'NO_MATCH' });
          }
          continue;
        }
        const found = await deps.lookupIp(visit.ipAddress);
        patch.city = found.city;
        patch.country = found.country;
        name = found.companyName ?? found.network;
        patch.companyName = name;
        domain = found.companyDomain ? domainOf(found.companyDomain) : null;
        if (domain) patch.companyDomain = domain;
      }
      summary.visits++;
      if (visit.personId) toEnroll.push(visit.personId);

      if (!domain) {
        await deps.updateVisit(visit.id, { ...patch, enrichStatus: 'NO_MATCH' });
        summary.noMatch++;
        continue;
      }
      if (own.has(domain)) {
        await deps.updateVisit(visit.id, { ...patch, enrichStatus: 'OWN_TEAM' });
        summary.ownTeam++;
        continue;
      }

      patch.companyId = await deps.findOrCreateCompany({ name, domain });
      patch.enrichStatus = 'MATCHED';
      summary.matched++;

      const remaining = config.dailyLeadCap - leadsToday;
      const max = Math.min(config.leadsPerCompany, remaining);
      if (deps.findLeads && max > 0 && !doneThisRun.has(domain)) {
        const until = await deps.getCompanyCooldown(domain);
        if (!until || new Date(until).getTime() <= now.getTime()) {
          doneThisRun.add(domain);
          const added = await deps.findLeads(domain, patch.companyId, max);
          await deps.setCompanyCooldown(domain, new Date(now.getTime() + config.companyCooldownDays * 86_400_000).toISOString());
          if (added.length > 0) {
            leadsToday += added.length;
            await deps.setLeadsToday(day, leadsToday);
            summary.leadsAdded += added.length;
            patch.leadsAdded = added.length;
            patch.enrichStatus = 'LEADS_ADDED';
            toEnroll.push(...added);
          }
        }
      }
      await deps.updateVisit(visit.id, patch);
    } catch (error) {
      summary.errors.push({ visitId: visit.id, error: errorText(error) });
      deps.log?.(`visitor ${visit.id}: ${errorText(error)}`);
      // A bad token or rate limit hits every visit: stop and retry next run.
      if (/IPinfo|Prospeo|credit/i.test(errorText(error))) break;
      await deps.updateVisit(visit.id, { enrichStatus: 'ERROR' }).catch(() => undefined);
    }
  }

  const unique = [...new Set(toEnroll)];
  if (unique.length > 0) summary.enrolled = await deps.enroll(unique);
  return summary;
};
