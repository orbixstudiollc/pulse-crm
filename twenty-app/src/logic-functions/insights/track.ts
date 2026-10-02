import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import { kv, Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { TRACK_LOGIC_FUNCTION_ID } from 'src/constants/insights-ids';
import {
  checkRateLimit,
  mergeVisit,
  newInboundLead,
  parseBody,
  requestInfo,
  validateBatch,
  visitFields,
  type ExistingVisit,
  type RateState,
} from 'src/insights/track-payload';

// Public beacon endpoint for the website tracking snippet (POST /s/track).
// Validates the body, rate-limits per visitor, then upserts the visitor's
// websiteVisit record (pages, time, scroll, clicks, IP for the company lookup)
// and links it to a Person when the email is known.

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
  const parsed = validateBatch(parseBody(event));
  if (!parsed.ok) return reply(400, { error: parsed.error });
  const { beacons } = parsed;
  const visitorId = beacons[0].visitorId;

  if (!(await allowHit(visitorId))) return reply(429, { error: 'Too many requests' });
  const request = requestInfo(event.headers);
  // Crawlers are not prospects.
  if (request.device === 'Bot') return reply(202, { ok: true });

  const client = new RestApiClient({ runAs: 'application' });

  const found = await client.get<ListResponse<'websiteVisits'>>('/rest/websiteVisits', {
    query: { filter: `visitorId[eq]:${quoted(visitorId)}`, limit: 1, depth: 0 },
  });
  const existing = found.data?.websiteVisits?.[0] ?? null;

  let personId: string | null = null;
  const identified = [...beacons].reverse().find((b) => b.email);
  if (identified?.email && !existing?.personId) {
    const email = identified.email;
    const people = await client.get<ListResponse<'people'>>('/rest/people', {
      query: { filter: `emails.primaryEmail[eq]:${quoted(email)}`, limit: 1, depth: 0 },
    });
    personId = people.data?.people?.[0]?.id ?? null;
    // A form fill from someone new is an inbound lead: add them.
    if (!personId && identified.type === 'identify') {
      const created = await client.post<{ data?: Record<string, { id: string }> }>('/rest/people', newInboundLead(email));
      personId = Object.values(created.data ?? {})[0]?.id ?? null;
    }
  }

  // Events in a batch are applied in order onto one record, then written once.
  const now = new Date();
  let state: ExistingVisit | null = existing;
  let record: Record<string, unknown> = {};
  for (const beacon of beacons) {
    const merged = mergeVisit(state, visitFields(beacon, now), beacon === identified ? personId : null, request);
    record = { ...record, ...merged };
    state = { ...state, ...merged } as ExistingVisit;
  }
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
    // The visitor's IP (for the company lookup), country and device.
    forwardedRequestHeaders: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip', 'cf-ipcountry', 'user-agent'],
  },
  handler,
});
