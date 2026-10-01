import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import { kv, Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { TRACK_LOGIC_FUNCTION_ID } from 'src/constants/insights-ids';
import {
  checkRateLimit,
  mergeVisit,
  parseBody,
  validateBeacon,
  visitFields,
  type ExistingVisit,
  type RateState,
} from 'src/insights/track-payload';

// Public beacon endpoint for the website tracking snippet (POST /s/track).
// Validates the body, rate-limits per visitor, then upserts the visitor's
// websiteVisit record and links it to a Person when the email is known.

const CORS = { 'Access-Control-Allow-Origin': '*' };

const reply = (status: number, body: unknown) => new Response(body, { status, headers: CORS });

type Row = ExistingVisit & { id: string };
type ListResponse<K extends string> = { data?: Record<K, Row[]> };

const quoted = (v: string) => `"${v.replace(/["\\]/g, '')}"`;

const allowHit = async (visitorId: string): Promise<boolean> => {
  const key = `track-rate:${visitorId}`;
  try {
    const { allowed, next } = checkRateLimit(await kv.get<RateState>(key), Date.now());
    if (allowed) await kv.set(key, next);
    return allowed;
  } catch {
    // Naive by design: if the key-value store is unavailable, let it through.
    return true;
  }
};

const handler = async (event: RoutePayload) => {
  const parsed = validateBeacon(parseBody(event));
  if (!parsed.ok) return reply(400, { error: parsed.error });
  const { beacon } = parsed;

  if (!(await allowHit(beacon.visitorId))) return reply(429, { error: 'Too many requests' });

  const client = new RestApiClient({ runAs: 'application' });

  const found = await client.get<ListResponse<'websiteVisits'>>('/rest/websiteVisits', {
    query: { filter: `visitorId[eq]:${quoted(beacon.visitorId)}`, limit: 1, depth: 0 },
  });
  const existing = found.data?.websiteVisits?.[0] ?? null;

  let personId: string | null = null;
  if (beacon.email && !existing?.personId) {
    const people = await client.get<ListResponse<'people'>>('/rest/people', {
      query: { filter: `emails.primaryEmail[eq]:${quoted(beacon.email)}`, limit: 1, depth: 0 },
    });
    personId = people.data?.people?.[0]?.id ?? null;
  }

  const record = mergeVisit(existing, visitFields(beacon, new Date()), personId);
  if (existing) await client.patch(`/rest/websiteVisits/${existing.id}`, record);
  else await client.post('/rest/websiteVisits', record);

  return reply(202, { ok: true });
};

export default defineLogicFunction({
  universalIdentifier: TRACK_LOGIC_FUNCTION_ID,
  name: 'track',
  description: 'Public website tracking beacon: upserts a websiteVisit per visitor',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/track',
    httpMethod: 'POST',
    isAuthRequired: false,
  },
  handler,
});
