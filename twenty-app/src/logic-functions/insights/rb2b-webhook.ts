import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import { kv, Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { RB2B_KEY_KV, RB2B_ROUTE_PATH, RB2B_WEBHOOK_FUNCTION_ID } from 'src/constants/insights-ids';
import { enrichPerson } from 'src/gtm/prospeo/api';
import { enrichedContact } from 'src/gtm/prospeo/people';
import { visitorEnrichConfig } from 'src/insights/enrich-visitors-runtime';
import { isPerson, parseRb2b, rb2bPersonPayload, rb2bVisitorId, rb2bVisitRecord, sameKey } from 'src/insights/rb2b';
import { parseBody, type ExistingVisit } from 'src/insights/track-payload';

// Public webhook for RB2B (POST /s/rb2b?key=...). RB2B has no signing, so the
// URL carries a random key that the Setup page creates and shows. Each post
// becomes a Person (with a Prospeo email when RB2B has none) and a websiteVisit
// that the visitor enrichment then turns into a company, leads and enrollment.

type Row = { id: string };
type ListResponse<K extends string, T = Row> = { data?: Record<K, T[]> };
type Created = { data?: Record<string, Row> };

const quoted = (v: string) => `"${v.replace(/["\\]/g, '')}"`;

const handler = async (event: RoutePayload) => {
  const expected = await kv.get<string>(RB2B_KEY_KV).catch(() => null);
  if (!sameKey(event.queryStringParameters?.key, expected)) return new Response({ error: 'Unauthorized' }, { status: 401 });

  const parsed = parseRb2b(parseBody(event));
  if (!parsed.ok) return new Response({ error: parsed.error }, { status: 400 });
  const v = parsed.visitor;
  const client = new RestApiClient({ runAs: 'application' });

  let companyId: string | null = null;
  if (v.domain) {
    const found = await client.get<ListResponse<'companies'>>('/rest/companies', {
      query: { filter: `domainName.primaryLinkUrl[ilike]:${quoted(`%${v.domain}%`)}`, limit: 1, depth: 0 },
    });
    companyId = found.data?.companies?.[0]?.id ?? null;
    if (!companyId) {
      const created = await client.post<Created>('/rest/companies', {
        name: v.companyName || v.domain,
        domainName: { primaryLinkUrl: `https://${v.domain}` },
      });
      companyId = Object.values(created.data ?? {})[0]?.id ?? null;
    }
  }

  let personId: string | null = null;
  if (isPerson(v)) {
    const byEmail = v.email
      ? await client.get<ListResponse<'people'>>('/rest/people', {
          query: { filter: `emails.primaryEmail[eq]:${quoted(v.email)}`, limit: 1, depth: 0 },
        })
      : null;
    const slug = v.linkedinUrl?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
    const byLinkedin =
      !byEmail?.data?.people?.length && slug
        ? await client.get<ListResponse<'people'>>('/rest/people', {
            query: { filter: `linkedinLink.primaryLinkUrl[ilike]:${quoted(`%/in/${slug}%`)}`, limit: 1, depth: 0 },
          })
        : null;
    personId = byEmail?.data?.people?.[0]?.id ?? byLinkedin?.data?.people?.[0]?.id ?? null;
    if (!personId) {
      const created = await client.post<Created>('/rest/people', rb2bPersonPayload(v, companyId));
      personId = Object.values(created.data ?? {})[0]?.id ?? null;
      if (personId && !v.email && v.linkedinUrl) await addEmail(client, personId, v.linkedinUrl);
    }
  }

  const visitorId = rb2bVisitorId(v);
  const found = await client.get<ListResponse<'websiteVisits', ExistingVisit & Row & { companyId?: string | null }>>(
    '/rest/websiteVisits',
    { query: { filter: `visitorId[eq]:${quoted(visitorId)}`, limit: 1, depth: 0 } },
  );
  const existing = found.data?.websiteVisits?.[0] ?? null;
  const record = rb2bVisitRecord(v, existing, personId, companyId);
  if (existing) await client.patch(`/rest/websiteVisits/${existing.id}`, record);
  else await client.post('/rest/websiteVisits', record);

  return new Response({ ok: true, personId, companyId }, { status: 200 });
};

// A work email from Prospeo by LinkedIn URL (1 credit), within the daily
// visitor-lead cap. A miss is fine: the person stays without an email.
const addEmail = async (client: RestApiClient, personId: string, linkedinUrl: string) => {
  const apiKey = process.env.PROSPEO_API_KEY?.trim();
  if (!apiKey) return;
  const day = new Date().toISOString().slice(0, 10);
  const used = (await kv.get<number>(`visitor-leads:${day}`).catch(() => 0)) ?? 0;
  if (used >= visitorEnrichConfig().dailyLeadCap) return;
  try {
    const contact = enrichedContact(await enrichPerson(apiKey, { linkedin_url: linkedinUrl }));
    await kv.set(`visitor-leads:${day}`, used + 1);
    if (!contact.email) return;
    const taken = await client.get<ListResponse<'people'>>('/rest/people', {
      query: { filter: `emails.primaryEmail[eq]:${quoted(contact.email)}`, limit: 1, depth: 0 },
    });
    if (taken.data?.people?.length) return;
    await client.patch(`/rest/people/${personId}`, { emails: { primaryEmail: contact.email } });
  } catch (error) {
    console.warn(`[rb2b] email lookup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export default defineLogicFunction({
  universalIdentifier: RB2B_WEBHOOK_FUNCTION_ID,
  name: 'rb2b-webhook',
  description: 'RB2B webhook: adds identified website visitors as People and website visits',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: { path: RB2B_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: false },
  handler,
});
