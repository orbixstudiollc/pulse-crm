import { describe, expect, it } from 'vitest';

import {
  companyKey,
  companyPayload,
  customerToPerson,
  dealToOpportunity,
  leadToPerson,
  splitName,
  toDomain,
  type PulseLead,
} from '../../scripts/import-pulse/mapping';

const lead: PulseLead = {
  id: 'l1',
  name: 'Ada Mary Lovelace',
  email: ' Ada@Example.com ',
  company: 'Analytical Engines',
  phone: '+44 20 1234 5678',
  linkedin: 'https://linkedin.com/in/ada',
  location: 'London',
  website: 'https://www.engines.io/about',
  industry: 'Software',
  employees: '11-50',
  title: 'CTO',
  status: 'hot',
  source: 'LinkedIn',
  score: 82,
  qualification_grade: 'b',
};

describe('Pulse import mapping', () => {
  it('splits names on the last space', () => {
    expect(splitName('Ada Mary Lovelace')).toEqual({ firstName: 'Ada Mary', lastName: 'Lovelace' });
    expect(splitName('Plato')).toEqual({ firstName: 'Plato', lastName: '' });
  });

  it('normalizes websites to bare domains', () => {
    expect(toDomain('https://www.engines.io/about')).toBe('engines.io');
    expect(toDomain('')).toBeNull();
  });

  it('keys companies by lower-cased name', () => {
    expect(companyKey('  Analytical Engines ')).toBe('company:analytical engines');
    expect(companyKey(null)).toBeNull();
    expect(companyPayload('Analytical Engines', { website: lead.website })).toEqual({
      name: 'Analytical Engines',
      pulseId: 'company:analytical engines',
      domainName: { primaryLinkUrl: 'https://engines.io' },
    });
  });

  it('maps a lead to a Person with GTM fields', () => {
    expect(leadToPerson(lead, 'c1')).toEqual({
      name: { firstName: 'Ada Mary', lastName: 'Lovelace' },
      pulseId: 'lead:l1',
      emails: { primaryEmail: 'ada@example.com' },
      phones: { primaryPhoneNumber: '+44 20 1234 5678' },
      jobTitle: 'CTO',
      linkedinLink: { primaryLinkUrl: 'https://linkedin.com/in/ada' },
      leadStatus: 'HOT',
      leadScore: 82,
      leadSource: 'LINKEDIN',
      icpGrade: 'B',
      companyId: 'c1',
    });
  });

  it('marks converted leads and customers as customers', () => {
    expect(leadToPerson({ ...lead, converted_at: '2026-09-01' }, null).leadStatus).toBe('CUSTOMER');
    expect(
      customerToPerson(
        {
          id: 'k1', first_name: 'Grace', last_name: 'Hopper', email: null, phone: null,
          company: null, job_title: null, industry: null, company_size: null, website: null, city: null,
        },
        null,
      ),
    ).toEqual({ name: { firstName: 'Grace', lastName: 'Hopper' }, pulseId: 'customer:k1', leadStatus: 'CUSTOMER' });
  });

  it('falls back to OTHER for unknown lead sources', () => {
    expect(leadToPerson({ ...lead, source: 'Trade Show' }, null).leadSource).toBe('OTHER');
  });

  it('maps deal stages and amounts, and skips lost deals', () => {
    const base = { id: 'd1', name: 'Pilot', company: null, value: 1500.5, close_date: '2026-11-01', contact_email: null };
    expect(dealToOpportunity({ ...base, stage: 'negotiation' }, { companyId: 'c1', pointOfContactId: null })).toEqual({
      name: 'Pilot',
      pulseId: 'deal:d1',
      stage: 'PROPOSAL',
      amount: { amountMicros: 1_500_500_000, currencyCode: 'USD' },
      closeDate: new Date('2026-11-01').toISOString(),
      companyId: 'c1',
    });
    expect(dealToOpportunity({ ...base, stage: 'closed_won' }, { companyId: null, pointOfContactId: null })?.stage).toBe('CUSTOMER');
    expect(dealToOpportunity({ ...base, stage: 'closed_lost' }, { companyId: null, pointOfContactId: null })).toBeNull();
  });
});
