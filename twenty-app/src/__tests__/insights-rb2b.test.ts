import { describe, expect, it } from 'vitest';

import { isPerson, parseRb2b, rb2bPersonPayload, rb2bVisitorId, rb2bVisitRecord, sameKey } from 'src/insights/rb2b';

const now = new Date('2026-10-02T12:00:00Z');

// RB2B's documented sample payload.
const sample = {
  'LinkedIn URL': 'https://www.linkedin.com/in/retentionadam/',
  'First Name': 'Adam',
  'Last Name': 'Robinson',
  Title: 'CEO @ Retention.com',
  'Company Name': 'Retention.com',
  'Business Email': 'adam@retention.com',
  Website: 'https://retention.com',
  Industry: 'Internet Technology & Services',
  'Employee Count': 60,
  'Estimate Revenue': '$22M rev',
  City: 'Austin',
  State: 'Texas',
  Zipcode: '73301',
  'Seen At': '2026-10-02T11:30:00+00:00',
  Referrer: 'https://www.google.com/',
  'Captured URL': 'https://orbix.studio/pricing?utm_source=linkedin',
  Tags: 'Hot Pages, Hot Leads',
};

const parse = (body: unknown) => {
  const result = parseRb2b(body, now);
  if (!result.ok) throw new Error(result.error);
  return result.visitor;
};

describe('parseRb2b', () => {
  it('reads a person', () => {
    const v = parse(sample);
    expect(v).toMatchObject({
      linkedinUrl: 'https://www.linkedin.com/in/retentionadam/',
      firstName: 'Adam',
      email: 'adam@retention.com',
      domain: 'retention.com',
      url: 'https://orbix.studio/pricing?utm_source=linkedin',
    });
    expect(v.seenAt.toISOString()).toBe('2026-10-02T11:30:00.000Z');
    expect(isPerson(v)).toBe(true);
    expect(rb2bVisitorId(v)).toBe('rb2b:retentionadam');
  });

  it('reads a company-only post', () => {
    const v = parse({ 'Company Name': 'Acme', Website: 'www.acme.com', 'Captured URL': 'https://orbix.studio/' });
    expect(isPerson(v)).toBe(false);
    expect(v.domain).toBe('acme.com');
    expect(rb2bVisitorId(v)).toBe('rb2b:acme.com');
  });

  it('falls back to now for an unreadable date', () => {
    expect(parse({ ...sample, 'Seen At': '2024-01-01T12:34:56:00.00+00.00' }).seenAt).toEqual(now);
  });

  it('rejects posts with nothing to go on', () => {
    expect(parseRb2b({ 'First Name': 'Adam' }, now).ok).toBe(false);
    expect(parseRb2b('nope', now).ok).toBe(false);
  });
});

describe('rb2b records', () => {
  it('builds a hot website lead', () => {
    expect(rb2bPersonPayload(parse(sample), 'c1')).toMatchObject({
      name: { firstName: 'Adam', lastName: 'Robinson' },
      jobTitle: 'CEO @ Retention.com',
      linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/in/retentionadam/' },
      emails: { primaryEmail: 'adam@retention.com' },
      location: 'Austin, Texas',
      companyId: 'c1',
      leadSource: 'WEBSITE',
      leadStatus: 'HOT',
    });
    expect(rb2bPersonPayload(parse({ ...sample, Tags: null }), null).leadStatus).toBe('WARM');
  });

  it('creates a pending visit linked to the person and company', () => {
    const record = rb2bVisitRecord(parse(sample), null, 'p1', 'c1');
    expect(record).toMatchObject({
      visitorId: 'rb2b:retentionadam',
      url: 'https://orbix.studio/pricing',
      referrer: 'https://www.google.com/',
      utmSource: 'linkedin',
      companyDomain: 'retention.com',
      companyName: 'Retention.com',
      companyId: 'c1',
      personId: 'p1',
      pageViews: 1,
      recentPages: '/pricing',
      enrichStatus: 'PENDING',
      lastAction: 'Identified by RB2B (Hot Pages, Hot Leads)',
    });
  });

  it('adds repeat visits to the same record', () => {
    const first = rb2bVisitRecord(parse(sample), null, 'p1', 'c1');
    const again = rb2bVisitRecord(
      parse({ ...sample, 'Captured URL': 'https://orbix.studio/contact', 'Seen At': '2026-10-02T11:50:00Z' }),
      { ...first, personId: 'p1', companyId: 'c1' },
      'p1',
      'c1',
    );
    expect(again.pageViews).toBe(2);
    expect(again.recentPages).toBe('/contact | /pricing');
    expect(again).not.toHaveProperty('enrichStatus');
    expect(again).not.toHaveProperty('companyId');
  });
});

describe('sameKey', () => {
  it('matches only the exact key', () => {
    expect(sameKey('abc123', 'abc123')).toBe(true);
    expect(sameKey('abc124', 'abc123')).toBe(false);
    expect(sameKey(undefined, 'abc123')).toBe(false);
    expect(sameKey('abc123', null)).toBe(false);
  });
});
