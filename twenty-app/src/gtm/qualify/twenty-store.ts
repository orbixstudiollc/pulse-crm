// Twenty implementation of the qualification and import stores, over the
// workspace GraphQL API. The classification fields (agencyConfidence,
// titleClassification, emailVerificationStatus, sourceRecordId, ...) were
// created in the workspace, not by this app, so they are used by name here.

import { CoreApiClient } from 'twenty-client-sdk/core';
import { kv } from 'twenty-sdk/logic-function';

import { createRecords, type Records } from 'src/gtm/agency/gql';
import { toDomain } from 'src/gtm/prospeo/people';
import type { ImportStore, QualifyCompany, QualifyIcp, QualifyPerson, QualifyStore } from 'src/gtm/qualify/store';
import { QUALIFICATION_STATUSES, type EmailStatus } from 'src/gtm/qualify/values';
import type { GraphqlClient } from 'src/gtm/sequences/twenty-store';

type Row = Record<string, any>;

const PERSON_SELECTION = {
  name: { firstName: true, lastName: true },
  jobTitle: true,
  emails: { primaryEmail: true },
  linkedinLink: { primaryLinkUrl: true },
  location: true,
  leadStatus: true,
  emailVerificationStatus: true,
  prospeoPersonId: true,
  companyId: true,
};

const toPerson = (r: Row): QualifyPerson => ({
  id: r.id,
  firstName: r.name?.firstName ?? null,
  lastName: r.name?.lastName ?? null,
  jobTitle: r.jobTitle ?? null,
  email: r.emails?.primaryEmail?.toLowerCase() ?? null,
  linkedinUrl: r.linkedinLink?.primaryLinkUrl ?? null,
  location: r.location ?? null,
  leadStatus: r.leadStatus ?? null,
  emailStatus: (r.emailVerificationStatus as EmailStatus | null) ?? null,
  prospeoPersonId: r.prospeoPersonId ?? null,
  companyId: r.companyId ?? null,
});

const toCompany = (r: Row): QualifyCompany => ({
  id: r.id,
  name: r.name ?? null,
  domain: r.domainName?.primaryLinkUrl ? toDomain(r.domainName.primaryLinkUrl) || null : null,
  industry: r.industry ?? null,
  headcount: r.headcountRange ?? null,
  location: [r.address?.addressCity, r.address?.addressState, r.address?.addressCountry].filter(Boolean).join(', ') || null,
  linkedinUrl: r.linkedinLink?.primaryLinkUrl ?? null,
  agencyConfidence: typeof r.agencyConfidence === 'number' ? r.agencyConfidence : null,
  agencyType: r.agencyType ?? null,
  classificationReason: r.classificationReason ?? null,
  researchedAt: r.websiteResearchAt ?? null,
});

// Twenty caps a GraphQL page at 200 records.
const MAX_PAGE = 200;

const chunks = <T>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

export const createQualifyStore = (records: Records = createRecords()): QualifyStore => ({
  async activeIcp() {
    const [icp] = await records.findMany<Row>(
      'icpProfiles',
      { isActive: { eq: true } },
      { name: true, description: true, industries: true, jobTitles: true, locations: true, headcount: true },
      1,
      [{ position: 'AscNullsFirst' }],
    );
    return icp ? (icp as QualifyIcp) : null;
  },
  async pendingPeople(limit) {
    const rows = await records.findMany<Row>('people', { qualificationStatus: { eq: 'PENDING' } }, PERSON_SELECTION, limit, [{ createdAt: 'AscNullsFirst' }]);
    return rows.map(toPerson);
  },
  async qualifiedPeople(limit) {
    const rows = await records.findMany<Row>('people', { qualificationStatus: { eq: 'QUALIFIED' } }, PERSON_SELECTION, limit, [{ leadScore: 'DescNullsLast' }]);
    return rows.map(toPerson);
  },
  async companies(ids) {
    const out: QualifyCompany[] = [];
    for (const chunk of chunks(ids, 100)) {
      const rows = await records.findMany<Row>(
        'companies',
        { id: { in: chunk } },
        {
          name: true,
          domainName: { primaryLinkUrl: true },
          industry: true,
          headcountRange: true,
          address: { addressCity: true, addressState: true, addressCountry: true },
          linkedinLink: { primaryLinkUrl: true },
          agencyConfidence: true,
          agencyType: true,
          classificationReason: true,
          websiteResearchAt: true,
        },
        chunk.length,
      );
      out.push(...rows.map(toCompany));
    }
    return out;
  },
  async enrollmentCounts(personIds) {
    const counts = new Map<string, number>();
    for (const chunk of chunks(personIds, 50)) {
      const rows = await records.findMany<Row>('sequenceEnrollments', { personId: { in: chunk } }, { personId: true }, MAX_PAGE);
      for (const r of rows) counts.set(r.personId, (counts.get(r.personId) ?? 0) + 1);
    }
    return counts;
  },
  async blockedHandles() {
    const rows = await records.findMany<Row>('blocklists', {}, { handle: true }, MAX_PAGE).catch(() => []);
    return new Set(rows.map((r) => String(r.handle ?? '').trim().toLowerCase()).filter(Boolean));
  },
  async ownDomains() {
    const rows = await records.findMany<Row>('mailboxes', {}, { email: true }, MAX_PAGE).catch(() => []);
    return new Set(rows.map((r) => String(r.email ?? '').split('@')[1]?.toLowerCase()).filter(Boolean) as string[]);
  },
  async personIdByEmail(email) {
    const [row] = await records.findMany<Row>('people', { emails: { primaryEmail: { eq: email } } }, {}, 1);
    return row?.id ?? null;
  },
  updateCompany: (id, data) => records.update('company', id, data),
  updatePerson: (id, data) => records.update('person', id, data),
  kvGet: (key) => kv.get(key),
  kvSet: (key, value) => kv.set(key, value),
});

export const createImportStore = (records: Records = createRecords()): ImportStore => ({
  async findPeople({ emails, sourceRecordIds, linkedinUrls, prospeoIds }) {
    const filters: Record<string, unknown>[] = [
      ...chunks(emails, 50).map((c) => ({ emails: { primaryEmail: { in: c } } })),
      ...chunks(sourceRecordIds, 50).map((c) => ({ sourceRecordId: { in: c } })),
      ...chunks(linkedinUrls, 50).map((c) => ({ linkedinLink: { primaryLinkUrl: { in: c } } })),
      ...chunks(prospeoIds, 50).map((c) => ({ prospeoPersonId: { in: c } })),
    ];
    const byId = new Map<string, Row>();
    for (const filter of filters) {
      const rows = await records.findMany<Row>(
        'people',
        filter,
        { emails: { primaryEmail: true }, sourceRecordId: true, linkedinLink: { primaryLinkUrl: true }, prospeoPersonId: true },
        MAX_PAGE,
      );
      for (const r of rows) byId.set(r.id, r);
    }
    return [...byId.values()].map((r) => ({
      id: r.id,
      email: r.emails?.primaryEmail ?? null,
      sourceRecordId: r.sourceRecordId ?? null,
      linkedinUrl: r.linkedinLink?.primaryLinkUrl ?? null,
      prospeoPersonId: r.prospeoPersonId ?? null,
    }));
  },
  async findCompanies({ domains, names }) {
    const out: { id: string; name?: string | null; domain?: string | null }[] = [];
    const selection = { name: true, domainName: { primaryLinkUrl: true } };
    for (const chunk of chunks(domains, 40)) {
      const rows = await records.findMany<Row>('companies', { or: chunk.map((d) => ({ domainName: { primaryLinkUrl: { ilike: `%${d}%` } } })) }, selection, MAX_PAGE);
      const wanted = new Set(chunk);
      for (const r of rows) {
        const domain = r.domainName?.primaryLinkUrl ? toDomain(r.domainName.primaryLinkUrl) : null;
        // ilike also matches sub-strings (ab.com in cab.com); keep exact domains only.
        if (domain && wanted.has(domain)) out.push({ id: r.id, name: r.name, domain });
      }
    }
    for (const chunk of chunks(names, 40)) {
      const rows = await records.findMany<Row>('companies', { name: { in: chunk } }, selection, MAX_PAGE);
      out.push(...rows.map((r) => ({ id: r.id, name: r.name, domain: r.domainName?.primaryLinkUrl ? toDomain(r.domainName.primaryLinkUrl) : null })));
    }
    return out;
  },
  createCompany: (data) => records.create('company', data),
  createPerson: (data) => records.create('person', data),
});

/** People per qualification status, for the Setup page. */
export const qualificationCounts = async (client: GraphqlClient = new CoreApiClient() as unknown as GraphqlClient): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const { value } of QUALIFICATION_STATUSES) {
    const res = await client.query({ people: { __args: { filter: { qualificationStatus: { eq: value } }, first: 1 }, totalCount: true } });
    counts[value] = Number(res?.people?.totalCount ?? 0);
  }
  return counts;
};
