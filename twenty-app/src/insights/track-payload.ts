// Pure parts of the public `track` route: body parsing, validation, the
// naive per-visitor rate limit and the record we upsert. No I/O here.

export const MAX_BEACON_BYTES = 4096;
export const RATE_LIMIT = { max: 30, windowMs: 60_000 } as const;

export type Beacon = {
  visitorId: string;
  url: string;
  referrer: string | null;
  email: string | null;
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

/** Validate a beacon `{ visitorId, url, referrer?, email? }`. */
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
  return {
    ok: true,
    beacon: {
      visitorId: b.visitorId,
      url: b.url as string,
      referrer: b.referrer ? (b.referrer as string) : null,
      email: b.email ? (b.email as string).trim().toLowerCase() : null,
    },
  };
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
  };
};

export type ExistingVisit = Partial<VisitFields> & { pageViews?: number | null; personId?: string | null };

/**
 * Merge a hit into the visitor's record. Latest page and time win; UTM,
 * referrer and company domain keep the first non-empty value (first touch).
 */
export const mergeVisit = (existing: ExistingVisit | null, hit: VisitFields, personId: string | null) => {
  const keep = <K extends keyof VisitFields>(k: K) => existing?.[k] || hit[k];
  return {
    visitorId: hit.visitorId,
    url: hit.url,
    visitedAt: hit.visitedAt,
    referrer: keep('referrer'),
    utmSource: keep('utmSource'),
    utmMedium: keep('utmMedium'),
    utmCampaign: keep('utmCampaign'),
    utmTerm: keep('utmTerm'),
    utmContent: keep('utmContent'),
    companyDomain: keep('companyDomain'),
    pageViews: (existing?.pageViews ?? 0) + 1,
    ...(existing ? {} : { firstVisitedAt: hit.visitedAt }),
    ...(personId && !existing?.personId ? { personId } : {}),
  };
};
