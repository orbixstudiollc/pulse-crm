import { describe, expect, it, vi } from 'vitest';

import { mergeSearchInput, planNewLeads } from 'src/gtm/leadfinder/dedupe';
import {
  companyPayloadFromProspeo,
  leadProfileFromPerson,
  personPayloadFromProspeo,
  scoreUpdate,
} from 'src/gtm/leadfinder/mapping';
import { toolOrRouteInput } from 'src/gtm/leadfinder/payload';
import { shouldRescore } from 'src/gtm/leadfinder/rescore-event';
import { inFilter } from 'src/gtm/leadfinder/twenty';
import { getProspeoKey, prospeoRequest, ProspeoError } from 'src/gtm/prospeo/client';
import {
  buildSearchFilters,
  clampPage,
  clampPageCount,
  enrichDatapoints,
  enrichedContact,
  personFields,
  toDomain,
  toList,
} from 'src/gtm/prospeo/people';

const searchResult = {
  person: {
    person_id: 'p-123',
    first_name: 'Ada',
    last_name: 'Lovelace',
    full_name: 'Ada Lovelace',
    current_job_title: 'Head of Marketing',
    location: { city: 'London', state: 'England', country: 'United Kingdom' },
    linkedin_url: 'https://www.linkedin.com/in/ada',
    email: { email: 'a***@engines.io', revealed: false, status: 'VERIFIED' },
  },
  company: {
    name: 'Analytical Engines',
    website: 'https://www.engines.io/about',
    industry: 'Software Development',
    headcount_range: '51-100',
    linkedin_url: 'https://www.linkedin.com/company/engines',
  },
};

describe('Prospeo search filters', () => {
  it('normalizes lists and domains', () => {
    expect(toList('a, b,,a')).toEqual(['a', 'b']);
    expect(toList(['x', ' ', 'x'])).toEqual(['x']);
    expect(toDomain('https://www.Engines.io/about')).toBe('engines.io');
  });

  it('builds filters, with headcount as a plain array of Prospeo labels', () => {
    expect(
      buildSearchFilters({
        jobTitles: ['CMO'],
        industries: ['Software Development'],
        locations: ['United Kingdom'],
        headcount: ['SIZE_51_100', '101-200', 'bogus'],
        companyWebsites: ['https://www.engines.io'],
      }),
    ).toEqual({
      person_job_title: { include: ['CMO'], match_mode: 'CONTAINS' },
      person_location_search: { include: ['United Kingdom'] },
      company_industry: { include: ['Software Development'] },
      company_headcount_range: ['51-100', '101-200'],
      company: { websites: { include: ['engines.io'] } },
    });
  });

  it('rejects an empty search', () => {
    expect(() => buildSearchFilters({ jobTitles: [], headcount: ['bogus'] })).toThrow(/at least one/);
  });

  it('clamps pages', () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(5000)).toBe(1000);
    expect(clampPageCount(99)).toBe(10);
  });

  it('lets explicit filters override the ICP field by field', () => {
    expect(mergeSearchInput({ jobTitles: ['CMO'], industries: ['Retail'] }, { jobTitles: ['CTO'], industries: [] })).toEqual({
      jobTitles: ['CTO'],
      industries: ['Retail'],
    });
  });
});

describe('Prospeo results to Twenty records', () => {
  const f = personFields(searchResult);

  it('extracts person and company fields, ignoring masked emails', () => {
    expect(f).toMatchObject({
      personId: 'p-123',
      fullName: 'Ada Lovelace',
      jobTitle: 'Head of Marketing',
      location: 'London, England, United Kingdom',
      companyDomain: 'engines.io',
      companyHeadcount: '51-100',
    });
    expect(f.email).toBeUndefined();
    expect(personFields({ person: { person_id: 'x', email: { email: 'Bob@X.com', revealed: true } } }).email).toBe('bob@x.com');
  });

  it('maps to a company payload', () => {
    expect(companyPayloadFromProspeo(f)).toEqual({
      name: 'Analytical Engines',
      domainName: { primaryLinkUrl: 'https://engines.io' },
      linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/company/engines' },
      industry: 'Software Development',
      headcountRange: '51-100',
    });
    expect(companyPayloadFromProspeo({})).toBeNull();
  });

  it('maps to a new Prospeo lead', () => {
    expect(
      personPayloadFromProspeo(f, { companyId: 'c1', score: { score: 85, grade: 'A', matches: {} } }),
    ).toEqual({
      name: { firstName: 'Ada', lastName: 'Lovelace' },
      jobTitle: 'Head of Marketing',
      location: 'London, England, United Kingdom',
      linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/in/ada' },
      prospeoPersonId: 'p-123',
      leadSource: 'PROSPEO',
      leadStatus: 'NEW',
      companyId: 'c1',
      leadScore: 85,
      icpGrade: 'A',
    });
    expect(personPayloadFromProspeo({ personId: 'x', fullName: 'Grace Brewster Hopper' }).name).toEqual({
      firstName: 'Grace Brewster',
      lastName: 'Hopper',
    });
  });

  it('dedupes on Prospeo id and email, within the batch too', () => {
    const plan = planNewLeads(
      [
        { personId: 'a', fullName: 'A' },
        { personId: 'b', fullName: 'B', email: 'b@x.com' },
        { personId: 'c', fullName: 'C', email: 'B@X.com' },
        { personId: 'd', fullName: 'D' },
        { personId: 'd', fullName: 'D again' },
        { fullName: 'No id' },
      ],
      { prospeoIds: ['a'], emails: [] },
    );
    expect(plan.toCreate.map((p) => p.personId)).toEqual(['b', 'd']);
    expect(plan.duplicates).toBe(3);
    expect(plan.unusable).toBe(1);
    expect(planNewLeads([{ personId: 'z', fullName: 'Z', email: 'z@x.com' }], { prospeoIds: [], emails: ['Z@x.com'] }).duplicates).toBe(1);
  });

  it('reads a Twenty person for scoring, falling back to company location and employees', () => {
    expect(
      leadProfileFromPerson({
        id: 'p',
        jobTitle: 'CMO',
        company: { id: 'c', industry: 'SaaS', employees: 75, address: { addressCity: 'Leeds', addressCountry: 'United Kingdom' } },
      }),
    ).toEqual({ jobTitle: 'CMO', industry: 'SaaS', location: 'Leeds, United Kingdom', headcount: 75 });
  });

  it('only writes a score when it changes', () => {
    const result = { score: 70, grade: 'B' as const, matches: {} };
    expect(scoreUpdate({ leadScore: 70, icpGrade: 'B' }, result)).toBeNull();
    expect(scoreUpdate({ leadScore: 60, icpGrade: 'B' }, result)).toEqual({ leadScore: 70, icpGrade: 'B' });
    expect(scoreUpdate({ leadScore: 60 }, null)).toBeNull();
  });
});

describe('enrichment', () => {
  it('prefers the Prospeo id, then LinkedIn, then name plus company, then email', () => {
    expect(enrichDatapoints({ prospeoPersonId: 'p1', linkedinUrl: 'l' })).toEqual({ person_id: 'p1' });
    expect(enrichDatapoints({ linkedinUrl: 'https://linkedin.com/in/a', fullName: 'Ada' })).toEqual({
      linkedin_url: 'https://linkedin.com/in/a',
      full_name: 'Ada',
    });
    expect(enrichDatapoints({ fullName: 'Ada', companyDomain: 'https://engines.io' })).toEqual({
      full_name: 'Ada',
      company_website: 'engines.io',
    });
    expect(enrichDatapoints({ fullName: 'Ada', email: 'a@x.com' })).toEqual({ email: 'a@x.com' });
    expect(enrichDatapoints({ fullName: 'Ada' })).toBeNull();
  });

  it('reads the revealed email and mobile', () => {
    expect(
      enrichedContact({
        person: { person_id: 'p1', email: { email: 'Ada@Engines.io', status: 'VERIFIED' }, mobile: { mobile: '+44 7700 900000' } },
      }),
    ).toEqual({ personId: 'p1', email: 'ada@engines.io', mobile: '+44 7700 900000', emailVerified: true });
  });
});

describe('Prospeo client', () => {
  it('reads the key from the environment', () => {
    expect(getProspeoKey({ PROSPEO_API_KEY: ' k ' })).toBe('k');
    expect(() => getProspeoKey({})).toThrow(ProspeoError);
  });

  it('posts with X-KEY and maps error codes', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: true, error_code: 'NO_RESULTS' }), { status: 400 }));
    const err = await prospeoRequest<never>('/search-person', { page: 1 }, 'key', fetchMock as unknown as typeof fetch).catch((e: unknown) => e as ProspeoError);
    expect(err).toBeInstanceOf(ProspeoError);
    expect(err.code).toBe('NO_RESULTS');
    expect(err.isEmpty).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.prospeo.io/search-person');
    expect((init.headers as Record<string, string>)['X-KEY']).toBe('key');
  });

  it('flags rate limits as retryable', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 429 }));
    const err = await prospeoRequest<never>('/enrich-person', {}, 'key', fetchMock as unknown as typeof fetch).catch((e: unknown) => e as ProspeoError);
    expect(err.isRetryable).toBe(true);
  });
});

describe('logic function plumbing', () => {
  it('unwraps tool input and HTTP route bodies', () => {
    expect(toolOrRouteInput({ personId: 'p' })).toEqual({ personId: 'p' });
    expect(toolOrRouteInput({ requestContext: {}, body: { personId: 'p' } })).toEqual({ personId: 'p' });
    expect(toolOrRouteInput({ requestContext: {}, body: '{"personId":"q"}' })).toEqual({ personId: 'q' });
    expect(toolOrRouteInput(null)).toEqual({});
  });

  it('skips rescoring when only score fields changed', () => {
    expect(shouldRescore({ recordId: 'p' })).toBe(true);
    expect(shouldRescore({ recordId: 'p', properties: { updatedFields: ['leadScore', 'icpGrade', 'updatedAt'] } })).toBe(false);
    expect(shouldRescore({ recordId: 'p', properties: { updatedFields: ['jobTitle'] } })).toBe(true);
    expect(shouldRescore({})).toBe(false);
  });

  it('builds REST in filters', () => {
    expect(inFilter('prospeoPersonId', ['a', 'b"c'])).toBe('prospeoPersonId[in]:["a","b\\"c"]');
  });
});
