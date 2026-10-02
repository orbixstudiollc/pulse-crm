import { RestApiClient } from 'twenty-client-sdk/rest';
import { kv } from 'twenty-sdk/logic-function';

import { addLeadsAtCompany } from 'src/gtm/leadfinder/leads-at-company';
import { createRecord, filterValue, findCompanyByDomain } from 'src/gtm/leadfinder/twenty';
import { createTwentyMailboxRepository } from 'src/gtm/mailbox/twenty-repository';
import { getProspeoKey } from 'src/gtm/prospeo/client';
import { enrollPeople } from 'src/gtm/sequences/enroll';
import { createTwentyStore } from 'src/gtm/sequences/twenty-store';
import {
  DEFAULT_VISITOR_ENRICH_CONFIG,
  type PendingVisit,
  type VisitorEnrichConfig,
  type VisitorEnrichDeps,
} from 'src/insights/enrich-visitors';
import { lookupIp } from 'src/insights/ip-company';
import { allowedCountries } from 'src/insights/visitor-regions';

export const DEFAULT_VISITOR_SEQUENCE_NAME = 'Website visitors';

const positiveInt = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const visitorEnrichConfig = (env: Record<string, string | undefined> = process.env): VisitorEnrichConfig => ({
  ...DEFAULT_VISITOR_ENRICH_CONFIG,
  leadsPerCompany: positiveInt(env.VISITOR_LEADS_PER_COMPANY, DEFAULT_VISITOR_ENRICH_CONFIG.leadsPerCompany),
  dailyLeadCap: positiveInt(env.VISITOR_LEADS_DAILY_CAP, DEFAULT_VISITOR_ENRICH_CONFIG.dailyLeadCap),
  countries: allowedCountries(env.VISITOR_COUNTRIES),
});

const hasProspeoKey = () => {
  try {
    return getProspeoKey();
  } catch {
    return null;
  }
};

type ListResponse<K extends string, T> = { data?: Record<K, T[]> };

// Real dependencies for the enrich-website-visitors cron.
export const createVisitorEnrichDeps = (now = new Date()): VisitorEnrichDeps => {
  const rest = new RestApiClient();
  const ipToken = process.env.IPINFO_TOKEN?.trim();
  const prospeoKey = hasProspeoKey();
  const sequenceName = process.env.VISITOR_SEQUENCE_NAME?.trim() || DEFAULT_VISITOR_SEQUENCE_NAME;
  return {
    async listPending(limit) {
      const res = await rest.get<ListResponse<'websiteVisits', PendingVisit>>('/rest/websiteVisits', {
        query: { filter: 'enrichStatus[eq]:"PENDING"', limit, depth: 0 },
      });
      return res.data?.websiteVisits ?? [];
    },
    async updateVisit(id, patch) {
      await rest.patch(`/rest/websiteVisits/${id}`, patch);
    },
    lookupIp: ipToken ? (ip) => lookupIp(ip, ipToken) : null,
    async ownDomains() {
      const mailboxes = await createTwentyMailboxRepository(rest).listMailboxes();
      return new Set(mailboxes.map((m) => m.email.split('@')[1]?.toLowerCase()).filter((d): d is string => Boolean(d)));
    },
    async findOrCreateCompany({ name, domain }) {
      const existing = await findCompanyByDomain(domain);
      if (existing) return existing.id;
      return (await createRecord('companies', { name: name || domain, domainName: { primaryLinkUrl: `https://${domain}` } })).id;
    },
    findLeads: prospeoKey ? (domain, companyId, max) => addLeadsAtCompany(prospeoKey, domain, companyId, max) : null,
    async enroll(personIds) {
      const res = await rest.get<ListResponse<'sequences', { id: string }>>('/rest/sequences', {
        query: { filter: `name[eq]:${filterValue(sequenceName)}`, limit: 1, depth: 0 },
      });
      const sequenceId = res.data?.sequences?.[0]?.id;
      if (!sequenceId) return 0;
      const result = await enrollPeople({ store: createTwentyStore(), input: { personIds, sequenceId }, now });
      return result.enrolled.length;
    },
    getCompanyCooldown: (domain) => kv.get<string>(`visitor-company:${domain}`),
    setCompanyCooldown: (domain, until) => kv.set(`visitor-company:${domain}`, until),
    getLeadsToday: async (day) => (await kv.get<number>(`visitor-leads:${day}`)) ?? 0,
    setLeadsToday: (day, count) => kv.set(`visitor-leads:${day}`, count),
    config: visitorEnrichConfig(),
    now,
    log: (message) => console.warn(`[visitors] ${message}`),
  };
};
