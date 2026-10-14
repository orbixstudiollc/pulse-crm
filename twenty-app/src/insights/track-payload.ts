// Pure parts of the public `track` route: body parsing, validation, the
// naive per-visitor rate limit and the record we upsert. No I/O here.

export const MAX_BEACON_BYTES = 16_384;
// Events per batched beacon.
export const MAX_BATCH_EVENTS = 20;
export const RATE_LIMIT = { max: 60, windowMs: 60_000 } as const;

export const BEACON_TYPES = ['pageview', 'engage', 'click', 'identify'] as const;
export type BeaconType = (typeof BEACON_TYPES)[number];

export type Beacon = {
  visitorId: string;
  url: string;
  referrer: string | null;
  email: string | null;
  // What happened. Older snippets send no type: a page view.
  type?: BeaconType;
  // engage: seconds the page was visible, deepest scroll in percent.
  seconds?: number;
  scroll?: number;
  // click: the button or link text.
  label?: string | null;
};

export type BeaconResult = { ok: true; beacon: Beacon } | { ok: false; error: string };

const VISITOR_ID = /^[A-Za-z0-9_-]{8,64}$/;
// Deliberately strict: no quotes, spaces or commas, so the value is also safe
// to drop into a REST filter string.
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,185}\.[A-Za-z]{2,24}$/;

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com',
]);

/** Turn whatever the route received into a JSON object, or null. */
export const parseBody = (event: {
  body?: unknown;
  rawBody?: string;
  isBase64Encoded?: boolean;
}): unknown => {
  let raw: unknown = event.body;
  if (raw == null && typeof event.rawBody === 'string') {
    raw = event.isBase64Encoded ? Buffer.from(event.rawBody, 'base64').toString('utf8') : event.rawBody;
  }
  if (typeof raw === 'string') {
    if (raw.length > MAX_BEACON_BYTES) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === 'object' && JSON.stringify(raw).length <= MAX_BEACON_BYTES) return raw;
  return null;
};

const httpUrl = (value: unknown): URL | null => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
};

const boundedNumber = (value: unknown, max: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : undefined;

/** Validate a beacon `{ visitorId, url, referrer?, email?, type?, seconds?, scroll?, label? }`. */
export const validateBeacon = (input: unknown): BeaconResult => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Body must be a JSON object' };
  const b = input as Record<string, unknown>;
  if (typeof b.visitorId !== 'string' || !VISITOR_ID.test(b.visitorId)) {
    return { ok: false, error: 'visitorId must be 8-64 letters, digits, _ or -' };
  }
  if (!httpUrl(b.url)) return { ok: false, error: 'url must be an http(s) URL' };
  if (b.referrer != null && b.referrer !== '' && !httpUrl(b.referrer)) {
    return { ok: false, error: 'referrer must be an http(s) URL' };
  }
  if (b.email != null && b.email !== '' && (typeof b.email !== 'string' || !EMAIL.test(b.email.trim()))) {
    return { ok: false, error: 'email is not valid' };
  }
  if (b.type != null && !BEACON_TYPES.includes(b.type as BeaconType)) {
    return { ok: false, error: `type must be one of ${BEACON_TYPES.join(', ')}` };
  }
  const beacon: Beacon = {
    visitorId: b.visitorId,
    url: b.url as string,
    referrer: b.referrer ? (b.referrer as string) : null,
    email: b.email ? (b.email as string).trim().toLowerCase() : null,
  };
  if (b.type && b.type !== 'pageview') beacon.type = b.type as BeaconType;
  const seconds = boundedNumber(b.seconds, 3600);
  const scroll = boundedNumber(b.scroll, 100);
  if (seconds !== undefined) beacon.seconds = seconds;
  if (scroll !== undefined) beacon.scroll = scroll;
  if (typeof b.label === 'string' && b.label.trim()) beacon.label = b.label.replace(/\s+/g, ' ').trim().slice(0, 80);
  return { ok: true, beacon };
};

export type BatchResult = { ok: true; beacons: Beacon[] } | { ok: false; error: string };

/**
 * Validate a batched beacon `{ visitorId, referrer?, url, events: [{ type, url?, ... }] }`
 * (the snippet sends one per second so events never race each other), or a
 * single-event beacon from older snippets.
 */
export const validateBatch = (input: unknown): BatchResult => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Body must be a JSON object' };
  const b = input as Record<string, unknown>;
  if (!Array.isArray(b.events)) {
    const single = validateBeacon(input);
    return single.ok ? { ok: true, beacons: [single.beacon] } : single;
  }
  if (b.events.length === 0 || b.events.length > MAX_BATCH_EVENTS) {
    return { ok: false, error: `events must list 1-${MAX_BATCH_EVENTS} events` };
  }
  const beacons: Beacon[] = [];
  for (const event of b.events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return { ok: false, error: 'Each event must be an object' };
    const e = event as Record<string, unknown>;
    const one = validateBeacon({ visitorId: b.visitorId, referrer: b.referrer, url: e.url ?? b.url, ...e });
    if (!one.ok) return one;
    beacons.push(one.beacon);
  }
  return { ok: true, beacons };
};

export type RateState = { windowStart: number; count: number };

/** Fixed-window counter: at most `max` hits per visitor per window. */
export const checkRateLimit = (
  prev: RateState | null,
  now: number,
  cfg: { max: number; windowMs: number } = RATE_LIMIT,
): { allowed: boolean; next: RateState } => {
  if (!prev || now - prev.windowStart >= cfg.windowMs || now < prev.windowStart) {
    return { allowed: true, next: { windowStart: now, count: 1 } };
  }
  if (prev.count >= cfg.max) return { allowed: false, next: prev };
  return { allowed: true, next: { windowStart: prev.windowStart, count: prev.count + 1 } };
};

export const companyDomainFromEmail = (email: string | null): string | null => {
  const domain = email?.split('@')[1]?.toLowerCase();
  return domain && !FREE_EMAIL_DOMAINS.has(domain) ? domain : null;
};

// Ad networks append a click id to the landing page URL.
const AD_CLICK_IDS: [param: string, network: string][] = [
  ['fbclid', 'Meta'],
  ['gclid', 'Google'],
  ['gbraid', 'Google'],
  ['wbraid', 'Google'],
  ['li_fat_id', 'LinkedIn'],
  ['msclkid', 'Microsoft'],
  ['ttclid', 'TikTok'],
  ['twclid', 'X'],
];

export const adClickFrom = (url: URL): string | null =>
  AD_CLICK_IDS.find(([param]) => url.searchParams.has(param))?.[1] ?? null;

// Request details the route sees: the visitor's IP and device.
export type RequestInfo = { ip: string | null; country: string | null; device: string | null };

const isPublicIp = (ip: string) =>
  !/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip);

/** The visitor's IP from proxy headers (first public address), country and device type. */
export const requestInfo = (headers: Record<string, string | undefined> | null | undefined): RequestInfo => {
  const h: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) if (value) h[key.toLowerCase()] = value;
  const candidates = [h['cf-connecting-ip'], h['true-client-ip'], h['x-real-ip'], ...(h['x-forwarded-for'] ?? '').split(',')]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v) && /^[0-9a-f:.]{3,45}$/i.test(v as string));
  const ip = candidates.find(isPublicIp) ?? null;
  const country = h['cf-ipcountry'] && /^[A-Z]{2}$/.test(h['cf-ipcountry']) && h['cf-ipcountry'] !== 'XX' ? h['cf-ipcountry'] : null;
  const ua = h['user-agent'] ?? '';
  const device = !ua ? null : /bot|crawl|spider|headless/i.test(ua) ? 'Bot' : /mobi|android|iphone|ipad/i.test(ua) ? 'Mobile' : 'Desktop';
  return { ip, country, device };
};

export type VisitFields = {
  visitorId: string;
  url: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  companyDomain: string | null;
  visitedAt: string;
  adClick: string | null;
  type: BeaconType;
  seconds: number;
  scroll: number;
  label: string | null;
};

const clip = (s: string | null, max = 255) => (s == null ? null : s.slice(0, max));

/**
 * Fields for this hit. The page is stored without its query string (UTMs are
 * pulled out first); referrers from the same site are dropped.
 */
export const visitFields = (beacon: Beacon, now: Date): VisitFields => {
  const page = new URL(beacon.url);
  const ref = beacon.referrer ? new URL(beacon.referrer) : null;
  const utm = (k: string) => clip(page.searchParams.get(`utm_${k}`) || null);
  return {
    visitorId: beacon.visitorId,
    url: `${page.origin}${page.pathname}`,
    referrer: ref && ref.host !== page.host ? `${ref.origin}${ref.pathname}` : null,
    utmSource: utm('source'),
    utmMedium: utm('medium'),
    utmCampaign: utm('campaign'),
    utmTerm: utm('term'),
    utmContent: utm('content'),
    companyDomain: companyDomainFromEmail(beacon.email),
    visitedAt: now.toISOString(),
    adClick: adClickFrom(page),
    type: beacon.type ?? 'pageview',
    seconds: beacon.seconds ?? 0,
    scroll: beacon.scroll ?? 0,
    label: beacon.label ?? null,
  };
};

export type ExistingVisit = Partial<Omit<VisitFields, 'type' | 'seconds' | 'scroll' | 'label'>> & {
  pageViews?: number | null;
  personId?: string | null;
  sessions?: number | null;
  engagedSeconds?: number | null;
  maxScroll?: number | null;
  ctaClicks?: number | null;
  recentPages?: string | null;
  lastAction?: string | null;
  ipAddress?: string | null;
  country?: string | null;
  device?: string | null;
};

// A new session starts after 30 minutes without a page view.
export const SESSION_GAP_MS = 30 * 60 * 1000;
const RECENT_PAGES = 10;
// Pages that show buying intent.
const HIGH_INTENT_PAGE = /pric|contact|demo|book|quote|consult|get-started|hire|services|case-stud|portfolio|work-with/i;

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
};

const pushRecentPage = (recent: string | null | undefined, url: string) => {
  const path = pathOf(url);
  const pages = (recent ?? '').split(' | ').filter((p) => p && p !== path);
  return [path, ...pages].slice(0, RECENT_PAGES).join(' | ');
};

/** 0-100: how warm this visitor looks, from views, return visits, time, key pages and clicks. */
export const intentScore = (visit: {
  pageViews?: number | null;
  sessions?: number | null;
  engagedSeconds?: number | null;
  ctaClicks?: number | null;
  recentPages?: string | null;
  personId?: string | null;
}): number => {
  const keyPages = (visit.recentPages ?? '').split(' | ').filter((p) => HIGH_INTENT_PAGE.test(p)).length;
  const score =
    Math.min(25, (visit.pageViews ?? 0) * 4) +
    Math.min(20, Math.max(0, (visit.sessions ?? 1) - 1) * 10) +
    Math.min(20, Math.floor((visit.engagedSeconds ?? 0) / 30) * 2) +
    Math.min(20, keyPages * 10) +
    Math.min(10, (visit.ctaClicks ?? 0) * 5) +
    (visit.personId ? 5 : 0);
  return Math.min(100, score);
};

/**
 * Merge a hit into the visitor's record. Page views move the latest page and
 * time on; UTM, referrer, ad click and company domain keep the first non-empty
 * value (first touch). Engage and click hits only add behaviour.
 */
export const mergeVisit = (
  existing: ExistingVisit | null,
  hit: VisitFields,
  personId: string | null,
  request: RequestInfo = { ip: null, country: null, device: null },
) => {
  const keep = <K extends keyof ExistingVisit & keyof VisitFields>(k: K) => existing?.[k] || hit[k];
  const isView = hit.type === 'pageview';
  const lastSeen = existing?.visitedAt ? new Date(existing.visitedAt).getTime() : null;
  const newSession = isView && (lastSeen === null || new Date(hit.visitedAt).getTime() - lastSeen >= SESSION_GAP_MS);

  const record = {
    visitorId: hit.visitorId,
    url: isView || !existing?.url ? hit.url : existing.url,
    visitedAt: hit.visitedAt,
    referrer: keep('referrer'),
    utmSource: keep('utmSource'),
    utmMedium: keep('utmMedium'),
    utmCampaign: keep('utmCampaign'),
    utmTerm: keep('utmTerm'),
    utmContent: keep('utmContent'),
    companyDomain: keep('companyDomain'),
    adClick: keep('adClick'),
    pageViews: (existing?.pageViews ?? 0) + (isView ? 1 : 0),
    sessions: (existing?.sessions ?? 0) + (newSession ? 1 : 0),
    engagedSeconds: (existing?.engagedSeconds ?? 0) + (hit.type === 'engage' ? Math.min(hit.seconds, 1800) : 0),
    maxScroll: Math.max(existing?.maxScroll ?? 0, hit.type === 'engage' ? hit.scroll : 0),
    ctaClicks: (existing?.ctaClicks ?? 0) + (hit.type === 'click' ? 1 : 0),
    recentPages: isView ? pushRecentPage(existing?.recentPages, hit.url) : (existing?.recentPages ?? null),
    lastAction:
      hit.type === 'click' && hit.label ? `Clicked "${hit.label}"` : hit.type === 'identify' ? 'Filled a form' : (existing?.lastAction ?? null),
    ipAddress: request.ip ?? existing?.ipAddress ?? null,
    country: existing?.country || request.country,
    device: existing?.device || request.device,
    ...(existing ? {} : { firstVisitedAt: hit.visitedAt }),
    // A newly identified visitor goes back through the lookup (and into the sequence).
    ...(personId && !existing?.personId ? { personId, enrichStatus: 'PENDING' as const } : {}),
  };
  return { ...record, intentScore: intentScore({ ...record, personId: personId ?? existing?.personId }) };
};

/** A Person for someone who filled in a form on the website. */
export const newInboundLead = (email: string) => {
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]+/).filter((p) => /^[a-z]{2,}$/i.test(p));
  const cap = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  return {
    name: { firstName: parts[0] ? cap(parts[0]) : '', lastName: parts.length > 1 ? cap(parts[parts.length - 1]) : '' },
    emails: { primaryEmail: email },
    leadSource: 'WEBSITE',
    leadStatus: 'HOT',
  };
};
