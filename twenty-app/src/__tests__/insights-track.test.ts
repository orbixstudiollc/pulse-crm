import { describe, expect, it } from 'vitest';

import {
  adClickFrom,
  checkRateLimit,
  intentScore,
  newInboundLead,
  requestInfo,
  companyDomainFromEmail,
  mergeVisit,
  parseBody,
  RATE_LIMIT,
  validateBatch,
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
    expect(parseBody({ body: JSON.stringify({ pad: 'x'.repeat(17000) }) })).toBeNull();
    expect(parseBody({ body: { pad: 'x'.repeat(17000) } })).toBeNull();
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
      adClick: null,
      type: 'pageview',
      seconds: 0,
      scroll: 0,
      label: null,
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
    expect(trackingSnippet('https://crm.example.com/s/track')).toContain("'https://crm.example.com/s/track'");
    // Twenty Cloud serves routes from a functions host without the /s prefix.
    const cloud = trackingSnippet('https://ws.withtwenty.com/track');
    expect(cloud).toContain("'https://ws.withtwenty.com/track'");
    expect(cloud).not.toContain('/track/s/track');
  });

  it('is valid JavaScript', () => {
    const body = trackingSnippet('https://crm.example.com').replace(/^<script>/, '').replace(/<\/script>$/, '');
    expect(() => new Function(body)).not.toThrow();
  });

  it('only uses ES5, which Google Tag Manager requires', () => {
    const body = trackingSnippet('https://crm.example.com');
    // GTM rejects function declarations inside blocks, let/const, arrows and template strings.
    expect(body).not.toMatch(/[{;]\s*function\s+\w+\s*\(/);
    expect(body).not.toMatch(/\b(let|const)\s/);
    expect(body).not.toContain('=>');
    expect(body).not.toContain('`');
  });
});

describe('behaviour tracking', () => {
  const t0 = new Date('2026-10-02T10:00:00Z');
  const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
  const hit = (over: Record<string, unknown>, when: Date) => {
    const r = validateBeacon({ visitorId: 'visitor-0001', url: 'https://orbix.co/', ...over });
    if (!r.ok) throw new Error(r.error);
    return visitFields(r.beacon, when);
  };

  it('accepts engage, click and identify beacons and bounds their numbers', () => {
    const r = validateBeacon({ visitorId: 'visitor-0001', url: 'https://a.io/', type: 'engage', seconds: 99999, scroll: 140, label: '  Book   a call ' });
    expect(r).toMatchObject({ ok: true, beacon: { type: 'engage', seconds: 3600, scroll: 100, label: 'Book a call' } });
    expect(validateBeacon({ visitorId: 'visitor-0001', url: 'https://a.io/', type: 'hack' }).ok).toBe(false);
  });

  it('adds up sessions, time, scroll, clicks and recent pages', () => {
    const request = { ip: '203.0.113.9', country: 'US', device: 'Desktop' };
    let v = mergeVisit(null, hit({ url: 'https://orbix.co/?fbclid=abc' }, at(0)), null, request);
    v = mergeVisit(v, hit({ url: 'https://orbix.co/pricing' }, at(1)), null, request);
    v = mergeVisit(v, hit({ url: 'https://orbix.co/pricing', type: 'engage', seconds: 120, scroll: 80 }, at(3)), null, request);
    v = mergeVisit(v, hit({ url: 'https://orbix.co/pricing', type: 'click', label: 'Book a call' }, at(3)), null, request);
    v = mergeVisit(v, hit({ url: 'https://orbix.co/contact' }, at(90)), null, { ip: '203.0.113.10', country: null, device: 'Mobile' });
    expect(v).toMatchObject({
      pageViews: 3,
      sessions: 2,
      engagedSeconds: 120,
      maxScroll: 80,
      ctaClicks: 1,
      adClick: 'Meta',
      recentPages: '/contact | /pricing | /',
      lastAction: 'Clicked "Book a call"',
      url: 'https://orbix.co/contact',
      ipAddress: '203.0.113.10',
      country: 'US',
      device: 'Desktop',
    });
    expect(v.intentScore).toBeGreaterThan(40);
  });

  it('sends a newly identified visitor back through the lookup', () => {
    const first = mergeVisit(null, hit({}, at(0)), null);
    expect(first).not.toHaveProperty('enrichStatus');
    expect(mergeVisit(first, hit({ type: 'identify', email: 'ada@acme.io' }, at(1)), 'p1')).toMatchObject({ personId: 'p1', enrichStatus: 'PENDING', lastAction: 'Filled a form', pageViews: 1 });
  });

  it('scores warm visitors higher', () => {
    expect(intentScore({ pageViews: 1, sessions: 1 })).toBeLessThan(10);
    expect(intentScore({ pageViews: 8, sessions: 3, engagedSeconds: 600, ctaClicks: 2, recentPages: '/pricing | /contact', personId: 'p1' })).toBe(100);
  });

  it('reads the ad network from click ids', () => {
    expect(adClickFrom(new URL('https://a.io/?gclid=1'))).toBe('Google');
    expect(adClickFrom(new URL('https://a.io/?li_fat_id=1'))).toBe('LinkedIn');
    expect(adClickFrom(new URL('https://a.io/'))).toBeNull();
  });

  it('takes the first public IP from proxy headers and spots bots', () => {
    expect(requestInfo({ 'X-Forwarded-For': '10.0.0.1, 198.51.100.7, 172.16.0.2', 'User-Agent': 'Mozilla/5.0 (iPhone)' })).toEqual({ ip: '198.51.100.7', country: null, device: 'Mobile' });
    expect(requestInfo({ 'cf-connecting-ip': '2001:db8::1', 'cf-ipcountry': 'GB', 'user-agent': 'Googlebot/2.1' })).toEqual({ ip: '2001:db8::1', country: 'GB', device: 'Bot' });
    expect(requestInfo({ 'x-forwarded-for': 'junk' })).toEqual({ ip: null, country: null, device: null });
  });

  it('turns a form email into a hot website lead', () => {
    expect(newInboundLead('ada.lovelace@engines.io')).toEqual({
      name: { firstName: 'Ada', lastName: 'Lovelace' },
      emails: { primaryEmail: 'ada.lovelace@engines.io' },
      leadSource: 'WEBSITE',
      leadStatus: 'HOT',
    });
    expect(newInboundLead('x9@a.io').name).toEqual({ firstName: '', lastName: '' });
  });
});

describe('validateBatch', () => {
  it('reads batched events in order, filling in the visitor and page', () => {
    const r = validateBatch({
      visitorId: 'visitor-0001',
      url: 'https://a.io/',
      referrer: 'https://google.com/',
      events: [{ url: 'https://a.io/pricing' }, { type: 'click', label: 'Book' }, { type: 'identify', email: 'Kim@Gamma.co' }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.beacons.map((b) => [b.type ?? 'pageview', b.url, b.visitorId, b.referrer])).toEqual([
      ['pageview', 'https://a.io/pricing', 'visitor-0001', 'https://google.com/'],
      ['click', 'https://a.io/', 'visitor-0001', 'https://google.com/'],
      ['identify', 'https://a.io/', 'visitor-0001', 'https://google.com/'],
    ]);
    expect(r.beacons[2].email).toBe('kim@gamma.co');
  });

  it('still takes single beacons and rejects bad batches', () => {
    expect(validateBatch(good)).toMatchObject({ ok: true, beacons: [{ visitorId: good.visitorId }] });
    expect(validateBatch({ visitorId: 'visitor-0001', url: 'https://a.io/', events: [] }).ok).toBe(false);
    expect(validateBatch({ visitorId: 'visitor-0001', url: 'https://a.io/', events: [{ type: 'nope' }] }).ok).toBe(false);
    expect(validateBatch({ visitorId: 'visitor-0001', url: 'https://a.io/', events: Array(21).fill({}) }).ok).toBe(false);
  });
});
