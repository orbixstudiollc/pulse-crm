import { cleanDomain } from 'src/insights/ip-company';
import { mergeVisit, type ExistingVisit } from 'src/insights/track-payload';

// RB2B (rb2b.com) identifies website visitors and posts each one to a webhook:
// a person (LinkedIn profile, name, title, often a work email) or, when
// "company-level" is on, just the company. We turn each post into a Person
// (when there is one) and a websiteVisit, which the visitor enrichment then
// picks up like any other visit: company record, Prospeo leads, sequence.
// Payload: https://support.rb2b.com/en/articles/8976614-setup-guide-webhook

export type Rb2bVisitor = {
  linkedinUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
  email: string | null;
  domain: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  seenAt: Date;
  referrer: string | null;
  url: string | null;
  tags: string | null;
};

type Obj = Record<string, unknown>;

const str = (value: unknown, max = 500) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

const httpUrl = (value: unknown) => {
  const raw = str(value, 2000);
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

const email = (value: unknown) => {
  const raw = str(value, 320)?.toLowerCase() ?? null;
  return raw && /^[^@\s"]+@[^@\s"]+\.[a-z]{2,}$/i.test(raw) ? raw : null;
};

export const parseRb2b = (body: unknown, now = new Date()): { ok: true; visitor: Rb2bVisitor } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Expected a JSON object' };
  const b = body as Obj;
  const linkedinUrl = httpUrl(b['LinkedIn URL']);
  const businessEmail = email(b['Business Email']);
  const domain = cleanDomain(b.Website) ?? (businessEmail ? cleanDomain(businessEmail.split('@')[1]) : null);
  if (!linkedinUrl && !domain) return { ok: false, error: 'No LinkedIn URL or company website' };
  const seen = str(b['Seen At']);
  const seenAt = seen && !Number.isNaN(Date.parse(seen)) ? new Date(seen) : now;
  return {
    ok: true,
    visitor: {
      linkedinUrl: linkedinUrl && /linkedin\.com\//i.test(linkedinUrl) ? linkedinUrl : null,
      firstName: str(b['First Name'], 100),
      lastName: str(b['Last Name'], 100),
      title: str(b.Title, 200),
      companyName: str(b['Company Name'], 200),
      email: businessEmail,
      domain,
      industry: str(b.Industry, 200),
      city: str(b.City, 100),
      state: str(b.State, 100),
      // RB2B's sample dates are not always valid ISO; fall back to now.
      seenAt: seenAt.getTime() > now.getTime() + 86_400_000 ? now : seenAt,
      referrer: httpUrl(b.Referrer),
      url: httpUrl(b['Captured URL']),
      tags: str(b.Tags, 200),
    },
  };
};

export const isPerson = (v: Rb2bVisitor) => Boolean(v.linkedinUrl || v.email);

/** One visit record per identified person (or per company when RB2B sends only the company). */
export const rb2bVisitorId = (v: Rb2bVisitor) => {
  const slug = v.linkedinUrl?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
  return `rb2b:${(slug ?? v.email ?? v.domain ?? 'unknown').toLowerCase()}`.slice(0, 120);
};

export const rb2bLocation = (v: Rb2bVisitor) => [v.city, v.state].filter(Boolean).join(', ') || null;

/** A Person for an identified visitor. RB2B's "Hot" tags mark them hot. */
export const rb2bPersonPayload = (v: Rb2bVisitor, companyId: string | null) => ({
  name: { firstName: v.firstName ?? '', lastName: v.lastName ?? '' },
  jobTitle: v.title ?? undefined,
  linkedinLink: v.linkedinUrl ? { primaryLinkUrl: v.linkedinUrl } : undefined,
  emails: v.email ? { primaryEmail: v.email } : undefined,
  location: rb2bLocation(v) ?? undefined,
  companyId: companyId ?? undefined,
  leadSource: 'WEBSITE',
  leadStatus: v.tags && /hot/i.test(v.tags) ? 'HOT' : 'WARM',
});

/** The websiteVisit fields for one RB2B post, merged onto the existing record. */
export const rb2bVisitRecord = (
  v: Rb2bVisitor,
  existing: (ExistingVisit & { companyId?: string | null }) | null,
  personId: string | null,
  companyId: string | null,
) => {
  const page = v.url ? new URL(v.url) : null;
  const ref = v.referrer ? new URL(v.referrer) : null;
  const merged = mergeVisit(
    existing,
    {
      visitorId: rb2bVisitorId(v),
      url: page ? `${page.origin}${page.pathname}` : (existing?.url ?? ''),
      referrer: ref && (!page || ref.host !== page.host) ? `${ref.origin}${ref.pathname}` : null,
      utmSource: page?.searchParams.get('utm_source') || null,
      utmMedium: page?.searchParams.get('utm_medium') || null,
      utmCampaign: page?.searchParams.get('utm_campaign') || null,
      utmTerm: page?.searchParams.get('utm_term') || null,
      utmContent: page?.searchParams.get('utm_content') || null,
      companyDomain: v.domain,
      visitedAt: v.seenAt.toISOString(),
      adClick: null,
      type: 'pageview',
      seconds: 0,
      scroll: 0,
      label: null,
    },
    personId,
  );
  return {
    ...merged,
    companyName: v.companyName,
    city: v.city,
    ...(companyId && !existing?.companyId ? { companyId } : {}),
    lastAction: v.tags ? `Identified by RB2B (${v.tags})` : 'Identified by RB2B',
    // New records start PENDING so the enrichment adds leads and enrolls them.
    ...(existing ? {} : { enrichStatus: 'PENDING' as const }),
  };
};

/** Constant-time compare for the webhook key. */
export const sameKey = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
