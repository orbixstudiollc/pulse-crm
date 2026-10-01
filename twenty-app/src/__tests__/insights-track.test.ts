import { describe, expect, it } from 'vitest';

import {
  checkRateLimit,
  companyDomainFromEmail,
  mergeVisit,
  parseBody,
  RATE_LIMIT,
  validateBeacon,
  visitFields,
} from 'src/insights/track-payload';
import { trackingSnippet } from 'src/insights/tracking-snippet';

const good = {
  visitorId: '3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c',
  url: 'https://acme.io/pricing?utm_source=linkedin&utm_campaign=q4&x=1',
  referrer: 'https://www.google.com/search?q=acme',
  email: ' Ada@Engines.io ',
};

describe('parseBody', () => {
  it('accepts an object, a JSON string, or a (base64) raw body', () => {
    expect(parseBody({ body: { a: 1 } })).toEqual({ a: 1 });
    expect(parseBody({ body: '{"a":1}' })).toEqual({ a: 1 });
    expect(parseBody({ body: null, rawBody: '{"a":1}' })).toEqual({ a: 1 });
    expect(parseBody({ rawBody: Buffer.from('{"a":1}').toString('base64'), isBase64Encoded: true })).toEqual({ a: 1 });
  });

  it('rejects junk and oversized bodies', () => {
    expect(parseBody({ body: 'not json' })).toBeNull();
    expect(parseBody({ body: null })).toBeNull();
    expect(parseBody({ body: JSON.stringify({ pad: 'x'.repeat(5000) }) })).toBeNull();
    expect(parseBody({ body: { pad: 'x'.repeat(5000) } })).toBeNull();
  });
});

describe('validateBeacon', () => {
  it('accepts a good beacon and normalises the email', () => {
    const r = validateBeacon(good);
    expect(r).toEqual({ ok: true, beacon: { ...good, email: 'ada@engines.io' } });
  });

  it('allows referrer and email to be missing or empty', () => {
    const r = validateBeacon({ visitorId: 'abcdefgh', url: 'http://a.io/', referrer: '', email: null });
    expect(r).toEqual({ ok: true, beacon: { visitorId: 'abcdefgh', url: 'http://a.io/', referrer: null, email: null } });
  });

  it.each([
    [null, 'Body must be a JSON object'],
    [[], 'Body must be a JSON object'],
    [{ ...good, visitorId: 'short' }, 'visitorId'],
    [{ ...good, visitorId: 'has"quote"inside' }, 'visitorId'],
    [{ ...good, visitorId: 42 }, 'visitorId'],
    [{ ...good, url: 'javascript:alert(1)' }, 'url'],
    [{ ...good, url: 'not a url' }, 'url'],
    [{ ...good, url: `https://a.io/${'x'.repeat(2100)}` }, 'url'],
    [{ ...good, referrer: 'ftp://x.io' }, 'referrer'],
    [{ ...good, email: 'ada"@x.io' }, 'email'],
    [{ ...good, email: 'nope' }, 'email'],
    [{ ...good, email: 7 }, 'email'],
  ])('rejects %j', (input, message) => {
    const r = validateBeacon(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
  });
});

describe('checkRateLimit', () => {
  it('allows up to the max per window, then blocks until the window resets', () => {
    let state = null as ReturnType<typeof checkRateLimit>['next'] | null;
    for (let i = 0; i < RATE_LIMIT.max; i++) {
      const r = checkRateLimit(state, 1000 + i);
      expect(r.allowed).toBe(true);
      state = r.next;
    }
    expect(checkRateLimit(state, 2000).allowed).toBe(false);
    const reset = checkRateLimit(state, 1000 + RATE_LIMIT.windowMs);
    expect(reset).toEqual({ allowed: true, next: { windowStart: 1000 + RATE_LIMIT.windowMs, count: 1 } });
  });
});

describe('visit records', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  const beacon = (validateBeacon(good) as { ok: true; beacon: any }).beacon;

  it('extracts UTMs, strips the query and keeps external referrers', () => {
    expect(visitFields(beacon, now)).toEqual({
      visitorId: good.visitorId,
      url: 'https://acme.io/pricing',
      referrer: 'https://www.google.com/search',
      utmSource: 'linkedin',
      utmMedium: null,
      utmCampaign: 'q4',
      utmTerm: null,
      utmContent: null,
      companyDomain: 'engines.io',
      visitedAt: now.toISOString(),
    });
    expect(visitFields({ ...beacon, referrer: 'https://acme.io/' }, now).referrer).toBeNull();
  });

  it('only derives a company domain from work emails', () => {
    expect(companyDomainFromEmail('a@gmail.com')).toBeNull();
    expect(companyDomainFromEmail(null)).toBeNull();
    expect(companyDomainFromEmail('a@Acme.io')).toBe('acme.io');
  });

  it('creates a first visit, then keeps first-touch fields and counts views', () => {
    const first = mergeVisit(null, visitFields(beacon, now), 'p1');
    expect(first).toMatchObject({ pageViews: 1, firstVisitedAt: now.toISOString(), personId: 'p1', utmSource: 'linkedin' });

    const later = new Date('2026-10-02T08:00:00Z');
    const second = mergeVisit(
      { ...first, personId: 'p1' },
      visitFields({ ...beacon, url: 'https://acme.io/docs?utm_source=google', referrer: null, email: null }, later),
      'p2',
    );
    expect(second).toMatchObject({
      url: 'https://acme.io/docs',
      visitedAt: later.toISOString(),
      utmSource: 'linkedin',
      companyDomain: 'engines.io',
      pageViews: 2,
    });
    expect(second).not.toHaveProperty('firstVisitedAt');
    expect(second).not.toHaveProperty('personId');
  });
});

describe('trackingSnippet', () => {
  it('points the beacon at the server /s/track route', () => {
    const s = trackingSnippet('https://crm.example.com/');
    expect(s).toContain("'https://crm.example.com/s/track'");
    expect(s).toContain('sendBeacon');
    expect(s).not.toContain('__ENDPOINT__');
  });
});
