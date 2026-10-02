import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';

import { RB2B_KEY_KV, TRACKING_SNIPPET_FUNCTION_ID, VISITOR_STATUS_ROUTE_PATH } from 'src/constants/insights-ids';
import { failure } from 'src/gtm/leadfinder/payload';
import { filterValue } from 'src/gtm/leadfinder/twenty';
import { DEFAULT_VISITOR_SEQUENCE_NAME, visitorEnrichConfig } from 'src/insights/enrich-visitors-runtime';

// Route behind the Setup page: is tracking live, and what is set up.
type Count = { totalCount?: number };

// The RB2B webhook key, created on first use. Only signed-in users reach this route.
const rb2bKey = async () => {
  const existing = await kv.get<string>(RB2B_KEY_KV);
  if (existing) return existing;
  const key = crypto.randomUUID().replace(/-/g, '');
  await kv.set(RB2B_KEY_KV, key);
  return key;
};

const handler = async () => {
  try {
    const rest = new RestApiClient();
    const count = async (filter?: string) => {
      const res = await rest.get<Count & { data?: unknown }>('/rest/websiteVisits', {
        query: { limit: 1, depth: 0, ...(filter ? { filter } : {}) },
      });
      return res.totalCount ?? 0;
    };
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const sequenceName = process.env.VISITOR_SEQUENCE_NAME?.trim() || DEFAULT_VISITOR_SEQUENCE_NAME;
    const sequences = await rest.get<{ data?: { sequences?: { id: string }[] } }>('/rest/sequences', {
      query: { filter: `name[eq]:${filterValue(sequenceName)}`, limit: 1, depth: 0 },
    });
    const [visitors, lastDay, companies, withLeads, lastVisit, rb2bVisitors, key] = await Promise.all([
      count(),
      count(`visitedAt[gte]:${filterValue(since)}`),
      count('companyId[is]:NOT_NULL'),
      count('enrichStatus[eq]:"LEADS_ADDED"'),
      rest.get<{ data?: { websiteVisits?: { visitedAt?: string | null }[] } }>('/rest/websiteVisits', {
        query: { limit: 1, depth: 0, order_by: 'visitedAt[DescNullsLast]' },
      }),
      count('visitorId[like]:"rb2b:%"'),
      rb2bKey(),
    ]);
    const config = visitorEnrichConfig();
    return {
      ok: true as const,
      visitors,
      lastDay,
      companies,
      withLeads,
      lastVisitAt: lastVisit.data?.websiteVisits?.[0]?.visitedAt ?? null,
      ipLookup: Boolean(process.env.IPINFO_TOKEN?.trim()),
      prospeo: Boolean(process.env.PROSPEO_API_KEY?.trim()),
      leadsPerCompany: config.leadsPerCompany,
      dailyLeadCap: config.dailyLeadCap,
      sequenceName,
      sequenceFound: Boolean(sequences.data?.sequences?.[0]),
      rb2bVisitors,
      rb2bKey: key,
    };
  } catch (error) {
    return failure(error);
  }
};

export default defineLogicFunction({
  universalIdentifier: TRACKING_SNIPPET_FUNCTION_ID,
  name: 'visitor-status',
  description: 'Website tracking status: visitors seen, companies found, leads added and what is configured',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: { path: VISITOR_STATUS_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  handler,
});
