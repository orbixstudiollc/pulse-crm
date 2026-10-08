import { describe, expect, it } from 'vitest';

import type { Classifier, CompanyVerdict, TitleVerdict } from 'src/gtm/qualify/classify';
import { parseCompanyVerdict, parseTitleVerdicts, titleKey } from 'src/gtm/qualify/classify';
import { emailStatusFrom, guessMapping, parseDelimited, parseLeadFile } from 'src/gtm/qualify/columns';
import { enrollQualified } from 'src/gtm/qualify/enroll';
import { gate, icpFit, suppressionReason, worthVerifying } from 'src/gtm/qualify/gate';
import { importLeads } from 'src/gtm/qualify/import';
import { choiceOf, companyDecision, jevClassifier, noulProbability } from 'src/gtm/qualify/jev';
import { qualifyPending, type EmailVerifier } from 'src/gtm/qualify/run';
import type { ImportStore, QualifyCompany, QualifyIcp, QualifyPerson, QualifyStore } from 'src/gtm/qualify/store';
import { classify, clampConfidence, readThreshold } from 'src/gtm/qualify/values';
import { htmlLinks, htmlToText, pickAboutPages, pickPageReader, researchWebsite, spiderPageReader } from 'src/gtm/qualify/website';
import type { SequenceStore } from 'src/gtm/sequences/store';

const APOLLO_HEADER =
  'First Name,Last Name,Title,Company,Company Name for Emails,Email,Email Status,Person Linkedin Url,Website,Company Linkedin Url,# Employees,Industry,City,State,Country,Apollo Contact Id';

describe('lead file columns', () => {
  it('maps an Apollo export header', () => {
    const m = guessMapping(APOLLO_HEADER.split(','));
    expect(m).toEqual([
      'firstName', 'lastName', 'jobTitle', 'companyName', null, 'email', 'emailStatus', 'linkedinUrl', 'companyDomain',
      'companyLinkedinUrl', 'headcount', 'industry', 'city', 'state', 'country', 'sourceRecordId',
    ]);
  });

  it('parses quoted commas, doubled quotes and line breaks', () => {
    expect(parseDelimited('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });

  it('reads tab-separated rows pasted from a sheet', () => {
    const file = parseLeadFile('Name\tEmail\tWebsite\nAnn Lee\tANN@Bright.co\thttps://www.bright.co/about');
    expect(file.rows[0]).toMatchObject({ firstName: 'Ann', lastName: 'Lee', email: 'ann@bright.co', companyDomain: 'bright.co' });
  });

  it('skips rows with nothing to identify the person', () => {
    const file = parseLeadFile(`${APOLLO_HEADER}\n,,CEO,Acme,,,,,acme.com,,,,,,,\nAnn,Lee,CEO,Acme,,ann@acme.com,Verified,,acme.com,,24,Marketing,,,United States,c1`);
    expect(file.rows).toHaveLength(1);
    expect(file.unusable).toEqual([1]);
    expect(file.rows[0]).toMatchObject({ sourceRecordId: 'c1', headcount: '24', country: 'United States' });
  });

  it('maps email statuses', () => {
    expect(emailStatusFrom('Verified', true)).toBe('VERIFIED');
    expect(emailStatusFrom('valid', true)).toBe('VERIFIED');
    expect(emailStatusFrom('Unverified', true)).toBe('UNVERIFIED');
    expect(emailStatusFrom('Extrapolated', true)).toBe('UNVERIFIED');
    expect(emailStatusFrom('Invalid', true)).toBe('INVALID');
    expect(emailStatusFrom('Verified', false)).toBe('UNKNOWN');
  });
});

describe('values', () => {
  it('classifies on the threshold', () => {
    expect(classify(0.85, 0.85)).toBe('QUALIFIED');
    expect(classify(0.84, 0.85)).toBe('REVIEW');
    expect(classify(0.49, 0.85)).toBe('REJECTED');
    expect(classify(null, 0.85)).toBeNull();
  });
  it('accepts 0-1 and percentages', () => {
    expect(clampConfidence(0.97)).toBe(0.97);
    expect(clampConfidence('92%')).toBe(0.92);
    expect(clampConfidence(140)).toBe(1);
    expect(clampConfidence('x')).toBeNull();
    expect(readThreshold(undefined)).toBe(0.85);
    expect(readThreshold('0.9')).toBe(0.9);
    expect(readThreshold('0.2')).toBe(0.85);
  });
});

const fitOk = { ok: true, notes: [] };

describe('gates', () => {
  const base = { companyConfidence: 0.97, titleConfidence: 0.88, emailStatus: 'VERIFIED' as const, suppressedReason: null, fit: fitOk, threshold: 0.85 };

  it('qualifies when everything passes; score is the weaker confidence', () => {
    expect(gate(base)).toEqual({ status: 'QUALIFIED', score: 88, grade: 'B', notes: [] });
  });

  it('holds borderline and unverified leads for review', () => {
    const r = gate({ ...base, titleConfidence: 0.64, emailStatus: 'UNVERIFIED' });
    expect(r.status).toBe('REVIEW');
    expect(r.score).toBe(64);
    expect(r.notes).toEqual(['Title confidence 64% is below 85%', 'Email not verified']);
  });

  it('rejects clear misses', () => {
    expect(gate({ ...base, companyConfidence: 0.2 }).status).toBe('REJECTED');
    expect(gate({ ...base, emailStatus: 'INVALID' }).status).toBe('REJECTED');
    expect(gate({ ...base, suppressedReason: 'on the blocklist' }).status).toBe('REJECTED');
    expect(gate({ ...base, fit: { ok: false, notes: ['Outside target locations (Berlin, Germany)'] } }).status).toBe('REJECTED');
  });

  it('reviews soft holds', () => {
    expect(gate({ ...base, holds: ['Already in a sequence'] })).toMatchObject({ status: 'REVIEW', notes: ['Already in a sequence'] });
  });

  it('verifies the email only when it is the last gate', () => {
    expect(worthVerifying({ ...base, emailStatus: 'UNVERIFIED' })).toBe(true);
    expect(worthVerifying({ ...base, emailStatus: 'UNVERIFIED', titleConfidence: 0.7 })).toBe(false);
    expect(worthVerifying({ ...base, emailStatus: 'VERIFIED' })).toBe(false);
  });

  it('checks ICP location and size when the ICP sets them', () => {
    const icp = { locations: ['United States'], headcount: ['SIZE_11_20', 'SIZE_21_50'] };
    expect(icpFit(icp, { location: 'Austin, Texas, United States', headcount: '24' }).ok).toBe(true);
    expect(icpFit(icp, { location: 'Austin, TX, USA', headcount: '11-20' }).ok).toBe(true);
    expect(icpFit(icp, { location: 'London, United Kingdom', headcount: '24' }).ok).toBe(false);
    expect(icpFit(icp, { location: 'United States', headcount: '120' }).ok).toBe(false);
    expect(icpFit(icp, { location: null, headcount: '24' })).toEqual({ ok: null, notes: ['Location unknown'] });
    expect(icpFit({}, { location: null, headcount: null }).ok).toBe(true);
  });

  it('finds suppression reasons', () => {
    const facts = { blockedHandles: new Set(['@spam.com', 'no@x.com']), ownDomains: new Set(['orbix.studio']) };
    expect(suppressionReason({ ...facts, email: 'a@spam.com' })).toBe('on the blocklist');
    expect(suppressionReason({ ...facts, email: 'no@x.com' })).toBe('on the blocklist');
    expect(suppressionReason({ ...facts, email: 'me@orbix.studio' })).toBe('one of our own sending domains');
    expect(suppressionReason({ ...facts, email: 'a@b.com', leadStatus: 'CUSTOMER' })).toBe('already a customer');
    expect(suppressionReason({ ...facts, email: 'a@b.com' })).toBeNull();
  });
});

describe('classifier parsing', () => {
  it('reads company verdicts from fenced JSON', () => {
    expect(parseCompanyVerdict('```json\n{"confidence": 0.91, "agencyType": "SEO", "reason": "Sells SEO to clients", "evidence": "\\"We grow rankings\\""}\n```')).toEqual({
      confidence: 0.91,
      agencyType: 'SEO',
      reason: 'Sells SEO to clients',
      evidence: '"We grow rankings"',
    });
    expect(parseCompanyVerdict('no json')).toBeNull();
  });

  it('reads title verdicts by index', () => {
    const out = parseTitleVerdicts({ results: [{ i: 1, confidence: 0.2, category: 'Other' }, { i: 0, confidence: 95, category: 'Founder' }] }, 3);
    expect(out[0]).toMatchObject({ confidence: 0.95, category: 'Founder' });
    expect(out[1]).toMatchObject({ confidence: 0.2 });
    expect(out[2]).toBeNull();
  });

  it('normalises titles for the cache', () => {
    expect(titleKey('  Co-Founder / CEO ')).toBe(titleKey('co founder ceo'));
  });
});

describe('Jev', () => {
  it('reads noul and choice answers in the shapes seen', () => {
    expect(noulProbability({ type: 'noul', noul: 0.93 })).toBe(0.93);
    expect(noulProbability({ noul: { probability: 0.4 } })).toBe(0.4);
    expect(noulProbability({ probabilities: { true: 0.7, false: 0.3 } })).toBe(0.7);
    expect(noulProbability(undefined)).toBeNull();
    expect(choiceOf({ choice: 'SEO' }, ['SEO', 'Other'])).toBe('SEO');
    expect(choiceOf({ probabilities: { SEO: 0.2, Other: 0.8 } }, ['SEO', 'Other'])).toBe('Other');
  });

  it('asks a noul and a choice question per company', async () => {
    const bodies: Record<string, any>[] = [];
    const client = async (body: Record<string, unknown>) => {
      bodies.push(body);
      return body.questions && 'fits_icp' in (body.questions as object)
        ? { fits_icp: { type: 'noul', noul: 0.9 }, agency_type: { type: 'choice', choice: 'Paid media' } }
        : { decision_maker: { noul: 0.97 }, category: { choice: 'Founder' } };
    };
    const jev = jevClassifier(client, 'typesafe/jev-1.13');
    const company = await jev.company({ name: 'ICP' }, { name: 'Acme', domain: 'acme.com' }, 'We run Google Ads for clients');
    expect(company).toMatchObject({ confidence: 0.9, agencyType: 'Paid media' });
    expect(bodies[0].model).toBe('typesafe/jev-1.13');
    expect(bodies[0].questions.fits_icp.type).toBe('noul');
    expect(bodies[0].state.message).toContain('Google Ads');
    const titles = await jev.titles({}, ['Founder', 'CEO']);
    expect(titles.map((t) => t?.category)).toEqual(['Founder', 'Founder']);
    expect(companyDecision('m', {}, {}, null).state.message).toContain('could not be read');
  });
});

describe('website research', () => {
  const html = `<html><head><title>Bright Agency</title><meta name="description" content="SEO &amp; paid media agency"></head>
    <body><script>var x=1</script><nav><a href="/services">Services</a><a href="/about-us/">About</a><a href="https://other.com/x">x</a></nav><h1>We grow brands</h1></body></html>`;

  it('turns HTML into text and finds same-site links', () => {
    const text = htmlToText(html);
    expect(text).toContain('Bright Agency');
    expect(text).toContain('SEO & paid media agency');
    expect(text).not.toContain('var x');
    const links = htmlLinks(html, 'https://bright.co/');
    expect(links).toEqual(['https://bright.co/services', 'https://bright.co/about-us/']);
    expect(pickAboutPages(links, 'https://bright.co/')).toEqual(['https://bright.co/services', 'https://bright.co/about-us/']);
  });

  it('reads the homepage and up to two about pages', async () => {
    const read = async (url: string) =>
      url === 'https://bright.co'
        ? { url: 'https://bright.co/', text: 'Home', links: ['https://bright.co/services', 'https://bright.co/blog'] }
        : url === 'https://bright.co/services'
          ? { url, text: 'We do SEO', links: [] }
          : null;
    const r = await researchWebsite('bright.co', read);
    expect(r?.pages.map((p) => p.url)).toEqual(['https://bright.co/', 'https://bright.co/services']);
    expect(r?.text).toContain('We do SEO');
    expect(await researchWebsite('dead.co', async () => null)).toBeNull();
  });
});

const fakeImportStore = (seed: { people?: any[]; companies?: any[] } = {}) => {
  const people: any[] = [...(seed.people ?? [])];
  const companies: any[] = [...(seed.companies ?? [])];
  const store: ImportStore = {
    async findPeople({ emails }) {
      return people.filter((p) => emails.includes(p.email));
    },
    async findCompanies({ domains, names }) {
      return companies.filter((c) => domains.includes(c.domain) || names.includes(c.name));
    },
    async createCompany(data) {
      const id = `c${companies.length + 1}`;
      companies.push({ id, ...data, domain: String((data.domainName as any)?.primaryLinkUrl ?? '').replace('https://', '') });
      return id;
    },
    async createPerson(data) {
      const id = `p${people.length + 1}`;
      people.push({ id, ...data, email: (data.emails as any)?.primaryEmail });
      return id;
    },
  };
  return { store, people, companies };
};

describe('import', () => {
  it('matches companies by domain, skips known and repeated people, queues new ones', async () => {
    const { store, people, companies } = fakeImportStore({
      people: [{ id: 'old', email: 'known@acme.com' }],
      companies: [{ id: 'acme', name: 'Acme', domain: 'acme.com' }],
    });
    const file = parseLeadFile(
      [
        'First Name,Last Name,Title,Company,Email,Email Status,Website,# Employees,Country',
        'Kim,Known,CEO,Acme,known@acme.com,Verified,acme.com,20,United States',
        'Ann,Lee,Founder,Acme,ann@acme.com,Verified,acme.com,20,United States',
        'Bo,Ray,Owner,Bright,bo@bright.co,Unverified,bright.co,12,United States',
        'Cy,Lu,Partner,Bright,cy@bright.co,,www.bright.co,12,United States',
        'Ann,Lee,Founder,Acme,ann@acme.com,Verified,acme.com,20,United States',
      ].join('\n'),
    );
    const r = await importLeads({ store, rows: file.rows });
    expect(r).toMatchObject({ received: 5, created: 3, companiesCreated: 1, companiesMatched: 1, skippedExisting: 1, skippedDuplicate: 1, failed: [] });
    expect(companies).toHaveLength(2);
    const ann = people.find((p) => p.email === 'ann@acme.com');
    expect(ann).toMatchObject({ companyId: 'acme', qualificationStatus: 'PENDING', emailVerificationStatus: 'VERIFIED', leadSource: 'IMPORT', location: 'United States' });
    const cy = people.find((p) => p.email === 'cy@bright.co');
    expect(cy).toMatchObject({ companyId: 'c2', emailVerificationStatus: 'UNVERIFIED' });
  });
});

type FakeQualify = QualifyStore & { people: Map<string, any>; companiesById: Map<string, any>; kv: Map<string, unknown> };

const fakeQualifyStore = (people: QualifyPerson[], companies: QualifyCompany[], icp: QualifyIcp | null = { id: 'icp', name: 'US agencies' }): FakeQualify => {
  const peopleById = new Map(people.map((p) => [p.id, { ...p, qualificationStatus: 'PENDING' } as any]));
  const companiesById = new Map(companies.map((c) => [c.id, { ...c } as any]));
  const kv = new Map<string, unknown>();
  return {
    people: peopleById,
    companiesById,
    kv,
    activeIcp: async () => icp,
    pendingPeople: async (limit) => [...peopleById.values()].filter((p) => p.qualificationStatus === 'PENDING').slice(0, limit),
    qualifiedPeople: async (limit) => [...peopleById.values()].filter((p) => p.qualificationStatus === 'QUALIFIED').slice(0, limit),
    companies: async (ids) => ids.map((id) => companiesById.get(id)).filter(Boolean).map((c) => ({ ...c, researchedAt: c.websiteResearchAt ?? c.researchedAt ?? null })),
    enrollmentCounts: async () => new Map(),
    blockedHandles: async () => new Set(['@blocked.com']),
    ownDomains: async () => new Set(['orbix.studio']),
    personIdByEmail: async (email) => [...peopleById.values()].find((p) => p.email === email)?.id ?? null,
    updateCompany: async (id, data) => void Object.assign(companiesById.get(id), data),
    updatePerson: async (id, data) => {
      const p = peopleById.get(id);
      Object.assign(p, data);
      if (data.emailVerificationStatus) p.emailStatus = data.emailVerificationStatus;
      if (data.emails) p.email = (data.emails as any).primaryEmail;
    },
    kvGet: async <T,>(key: string) => (kv.get(key) as T) ?? null,
    kvSet: async (key, value) => void kv.set(key, value),
  };
};

const fakeClassifier = (label: string, companies: Record<string, number>, titles: Record<string, number>, calls: string[] = []): Classifier => ({
  label,
  async company(_icp, company): Promise<CompanyVerdict | null> {
    calls.push(`${label}:company:${company.name}`);
    const c = companies[company.name ?? ''];
    return c === undefined ? null : { confidence: c, agencyType: 'SEO', reason: `${label} says ${c}`, evidence: null };
  },
  async titles(_icp, list): Promise<(TitleVerdict | null)[]> {
    calls.push(`${label}:titles:${list.join('|')}`);
    return list.map((t) => (titles[t] === undefined ? null : { confidence: titles[t], category: 'Founder', reason: label }));
  },
});

const pages = async (url: string) => ({ url, text: `Website of ${url}`, links: [] });

describe('qualifier', () => {
  const companies: QualifyCompany[] = [
    { id: 'acme', name: 'Acme', domain: 'acme.com', headcount: '24', location: 'Austin, United States' },
    { id: 'meh', name: 'Meh', domain: 'meh.com' },
    { id: 'saas', name: 'SaaS', domain: 'saas.io' },
  ];
  const people: QualifyPerson[] = [
    { id: 'ann', firstName: 'Ann', jobTitle: 'Founder', email: 'ann@acme.com', emailStatus: 'VERIFIED', companyId: 'acme', leadStatus: 'NEW' },
    { id: 'bo', firstName: 'Bo', jobTitle: 'Founder', email: 'bo@acme.com', emailStatus: 'UNVERIFIED', companyId: 'acme', leadStatus: 'NEW' },
    { id: 'cy', firstName: 'Cy', jobTitle: 'Intern', email: 'cy@acme.com', emailStatus: 'VERIFIED', companyId: 'acme', leadStatus: 'NEW' },
    { id: 'di', firstName: 'Di', jobTitle: 'Founder', email: 'di@meh.com', emailStatus: 'VERIFIED', companyId: 'meh', leadStatus: 'NEW' },
    { id: 'ed', firstName: 'Ed', jobTitle: 'Founder', email: 'ed@saas.io', emailStatus: 'VERIFIED', companyId: 'saas', leadStatus: 'NEW' },
    { id: 'fa', firstName: 'Fa', jobTitle: 'Founder', email: 'fa@blocked.com', emailStatus: 'VERIFIED', companyId: 'acme', leadStatus: 'NEW' },
  ];

  it('classifies, verifies, escalates borderline results and gates each lead', async () => {
    const calls: string[] = [];
    const store = fakeQualifyStore(people, companies);
    const verified: string[] = [];
    const verifyEmail: EmailVerifier = async (p) => {
      verified.push(p.id);
      return { email: p.email!, verified: true, prospeoPersonId: 'pp1' };
    };
    const result = await qualifyPending({
      store,
      bulk: fakeClassifier('jev', { Acme: 0.95, Meh: 0.7, SaaS: 0.1 }, { Founder: 0.9, Intern: 0.05 }, calls),
      review: fakeClassifier('llm', { Meh: 0.75 }, {}, calls),
      readPage: pages,
      verifyEmail,
      threshold: 0.85,
      dailyVerifications: 10,
      now: new Date('2026-10-08T09:00:00Z'),
    });

    expect(result).toMatchObject({ ok: true, companiesClassified: 3, peopleProcessed: 6, qualified: 2, review: 1, rejected: 3, verified: 1 });
    expect(calls).toContain('llm:company:Meh');
    expect(calls).not.toContain('llm:company:Acme');

    const p = (id: string) => store.people.get(id);
    expect(p('ann')).toMatchObject({ qualificationStatus: 'QUALIFIED', leadScore: 90, icpGrade: 'B', leadStatus: 'QUALIFIED', titleClassification: 'QUALIFIED' });
    expect(p('bo')).toMatchObject({ qualificationStatus: 'QUALIFIED', emailVerificationStatus: 'VERIFIED', prospeoPersonId: 'pp1' });
    expect(verified).toEqual(['bo']);
    expect(p('cy')).toMatchObject({ qualificationStatus: 'REJECTED', leadStatus: 'DISQUALIFIED' });
    expect(p('di')).toMatchObject({ qualificationStatus: 'REVIEW', qualificationNotes: 'Company confidence 75% is below 85%' });
    expect(p('ed').qualificationStatus).toBe('REJECTED');
    expect(p('fa').qualificationNotes).toContain('Suppressed: on the blocklist');

    const acme = store.companiesById.get('acme');
    expect(acme).toMatchObject({ agencyClassification: 'QUALIFIED', agencyConfidence: 0.95, classificationModel: 'jev', websiteResearchAt: '2026-10-08' });
    expect(acme.websiteResearch.markdown).toContain('https://acme.com');
    expect(store.companiesById.get('meh')).toMatchObject({ agencyClassification: 'REVIEW', classificationModel: 'llm' });

    // Titles are cached: a second batch does not ask again.
    calls.length = 0;
    store.people.set('gi', { id: 'gi', jobTitle: 'founder', email: 'gi@acme.com', emailStatus: 'VERIFIED', companyId: 'acme', qualificationStatus: 'PENDING' });
    await qualifyPending({ store, bulk: fakeClassifier('jev', {}, {}, calls), readPage: pages, threshold: 0.85, dailyVerifications: 0 });
    expect(calls).toEqual([]);
    expect(store.people.get('gi').qualificationStatus).toBe('QUALIFIED');
  });

  it('waits for companies beyond the per-run limit and needs an active ICP', async () => {
    const store = fakeQualifyStore(people.slice(3, 5), companies);
    const r = await qualifyPending({ store, bulk: fakeClassifier('jev', { Meh: 0.9, SaaS: 0.9 }, { Founder: 0.9 }), readPage: pages, threshold: 0.85, dailyVerifications: 0, companiesLimit: 1 });
    expect(r).toMatchObject({ companiesClassified: 1, peopleProcessed: 1, waiting: 1 });

    const none = fakeQualifyStore(people, companies, null);
    expect(await qualifyPending({ store: none, bulk: fakeClassifier('jev', {}, {}), readPage: pages, threshold: 0.85, dailyVerifications: 0 })).toMatchObject({ ok: false });
  });

  it('sends leads to review when the email check fails, and stops checking', async () => {
    const store = fakeQualifyStore(
      [
        { id: 'a', jobTitle: 'Founder', email: 'a@acme.com', emailStatus: 'UNVERIFIED', companyId: 'acme' },
        { id: 'b', jobTitle: 'Founder', email: 'b@acme.com', emailStatus: 'UNVERIFIED', companyId: 'acme' },
      ],
      companies,
    );
    let tries = 0;
    const r = await qualifyPending({
      store,
      bulk: fakeClassifier('jev', { Acme: 0.95 }, { Founder: 0.95 }),
      readPage: pages,
      verifyEmail: async () => {
        tries++;
        throw new Error('Your Prospeo account is out of credits');
      },
      threshold: 0.85,
      dailyVerifications: 10,
    });
    expect(tries).toBe(1);
    expect(r).toMatchObject({ review: 2 });
    expect(store.people.get('a').qualificationNotes).toContain('Email check failed: Your Prospeo account is out of credits');
  });
});

describe('enroll qualified', () => {
  it('enrolls verified, unsuppressed Qualified leads and marks them Enrolled', async () => {
    const store = fakeQualifyStore(
      [
        { id: 'a', email: 'a@acme.com', emailStatus: 'VERIFIED' },
        { id: 'b', email: 'b@acme.com', emailStatus: 'UNVERIFIED' },
        { id: 'c', email: 'c@blocked.com', emailStatus: 'VERIFIED' },
      ],
      [],
    );
    for (const p of store.people.values()) p.qualificationStatus = 'QUALIFIED';
    const enrolledIds: string[] = [];
    const sequences = {
      getSequence: async () => ({ id: 's1', name: 'Agencies', steps: [{ id: 'st', type: 'EMAIL', stepOrder: 1, delayDays: 0 }] }),
      findEnrollments: async () => [],
      getPeople: async (ids: string[]) => ids.map((id) => ({ id, emails: { primaryEmail: `${id}@acme.com` }, leadStatus: 'QUALIFIED' })),
      createEnrollment: async (e: { personId: string }) => {
        enrolledIds.push(e.personId);
        return `e-${e.personId}`;
      },
      incrementCampaignStats: async () => undefined,
    } as unknown as SequenceStore;

    const dry = await enrollQualified({ store, sequences, input: { sequenceId: 's1', dryRun: true } });
    expect(dry).toMatchObject({ eligible: 1, enrolled: 0 });
    expect(enrolledIds).toEqual([]);

    const r = await enrollQualified({ store, sequences, input: { sequenceId: 's1' } });
    expect(r).toMatchObject({ eligible: 1, enrolled: 1 });
    expect(r.skipped.map((s) => s.reason)).toEqual(['Email not verified', 'Suppressed: on the blocklist']);
    expect(store.people.get('a').qualificationStatus).toBe('ENROLLED');
  });
});

describe('website readers', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('reads a Spider page and keeps same-site links', async () => {
    const fetchImpl = (async () =>
      json([{ url: 'https://acme.co', status: 200, content: '# Acme\nWe build [services](https://acme.co/services) and [x](https://other.com/a)' }])) as unknown as typeof fetch;
    const page = await spiderPageReader('key', fetchImpl)('https://acme.co');
    expect(page?.text).toContain('Acme');
    expect(page?.links).toEqual(['https://acme.co/services']);
  });

  it('takes turns between Firecrawl and Spider per website and falls back when one fails', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (String(input).includes('firecrawl')) {
        calls.push(`firecrawl ${body.url}`);
        return json({ error: 'no credits' }, 402);
      }
      calls.push(`spider ${body.url}`);
      return json([{ url: body.url, status: 200, content: 'hello' }]);
    }) as unknown as typeof fetch;
    const { read, source } = pickPageReader({ FIRECRAWL_API_KEY: 'fc', SPIDER_API_KEY: 'sp' }, fetchImpl);
    expect(source).toBe('firecrawl+spider');
    expect((await read('https://a.co'))?.text).toBe('hello');
    expect((await read('https://b.co'))?.text).toBe('hello');
    expect(calls).toEqual(['spider https://a.co', 'firecrawl https://b.co', 'spider https://b.co']);
  });
});
