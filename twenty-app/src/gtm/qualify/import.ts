// Import lead rows: match or create Companies (by domain, then exact name) and
// People (skipping anyone already in the CRM by email, source record ID,
// LinkedIn URL or Prospeo ID). New people start as Pending, so the qualifier
// picks them up.

import { emailStatusFrom, personLocation, type LeadRow } from 'src/gtm/qualify/columns';
import type { ExistingCompany, ImportStore } from 'src/gtm/qualify/store';

export const MAX_IMPORT_ROWS = 250;

export type ImportResult = {
  received: number;
  created: number;
  companiesCreated: number;
  companiesMatched: number;
  skippedExisting: number;
  skippedDuplicate: number;
  failed: { row: number; error: string }[];
};

const normLinkedin = (url: string) =>
  url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

const normName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

const linkUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);

const keysOf = (row: LeadRow) =>
  [
    row.email && `e:${row.email}`,
    row.sourceRecordId && `s:${row.sourceRecordId}`,
    row.linkedinUrl && `l:${normLinkedin(row.linkedinUrl)}`,
    row.prospeoPersonId && `p:${row.prospeoPersonId}`,
  ].filter(Boolean) as string[];

export const companyPayload = (row: LeadRow): Record<string, unknown> => {
  const payload: Record<string, unknown> = { name: row.companyName || row.companyDomain };
  if (row.companyDomain) payload.domainName = { primaryLinkUrl: `https://${row.companyDomain}` };
  if (row.companyLinkedinUrl) payload.linkedinLink = { primaryLinkUrl: linkUrl(row.companyLinkedinUrl) };
  if (row.industry) payload.industry = row.industry;
  if (row.headcount) payload.headcountRange = row.headcount;
  if (row.companyCity || row.companyCountry) {
    payload.address = { addressCity: row.companyCity ?? '', addressCountry: row.companyCountry ?? '' };
  }
  return payload;
};

export const personPayload = (row: LeadRow, companyId: string | null): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    name: { firstName: row.firstName ?? '', lastName: row.lastName ?? '' },
    leadSource: row.prospeoPersonId ? 'PROSPEO' : 'IMPORT',
    leadStatus: 'NEW',
    qualificationStatus: 'PENDING',
    emailVerificationStatus: emailStatusFrom(row.emailStatus, Boolean(row.email)),
  };
  if (row.email) payload.emails = { primaryEmail: row.email };
  if (row.jobTitle) payload.jobTitle = row.jobTitle;
  if (row.linkedinUrl) payload.linkedinLink = { primaryLinkUrl: linkUrl(row.linkedinUrl) };
  const location = personLocation(row);
  if (location) payload.location = location;
  if (row.sourceRecordId) payload.sourceRecordId = row.sourceRecordId;
  if (row.prospeoPersonId) payload.prospeoPersonId = row.prospeoPersonId;
  if (companyId) payload.companyId = companyId;
  return payload;
};

export const importLeads = async ({ store, rows }: { store: ImportStore; rows: LeadRow[] }): Promise<ImportResult> => {
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`Send at most ${MAX_IMPORT_ROWS} rows per call`);
  const result: ImportResult = {
    received: rows.length,
    created: 0,
    companiesCreated: 0,
    companiesMatched: 0,
    skippedExisting: 0,
    skippedDuplicate: 0,
    failed: [],
  };

  // Already in the CRM.
  const existing = await store.findPeople({
    emails: [...new Set(rows.map((r) => r.email).filter(Boolean) as string[])],
    sourceRecordIds: [...new Set(rows.map((r) => r.sourceRecordId).filter(Boolean) as string[])],
    linkedinUrls: [...new Set(rows.map((r) => r.linkedinUrl).filter(Boolean).map((u) => linkUrl(u!)))],
    prospeoIds: [...new Set(rows.map((r) => r.prospeoPersonId).filter(Boolean) as string[])],
  });
  const known = new Set<string>();
  for (const p of existing) {
    if (p.email) known.add(`e:${p.email.toLowerCase()}`);
    if (p.sourceRecordId) known.add(`s:${p.sourceRecordId}`);
    if (p.linkedinUrl) known.add(`l:${normLinkedin(p.linkedinUrl)}`);
    if (p.prospeoPersonId) known.add(`p:${p.prospeoPersonId}`);
  }

  // Companies: by domain first, then exact name for rows without a domain.
  const found = await store.findCompanies({
    domains: [...new Set(rows.map((r) => r.companyDomain).filter(Boolean) as string[])],
    names: [...new Set(rows.filter((r) => !r.companyDomain && r.companyName).map((r) => r.companyName!))],
  });
  const byDomain = new Map<string, ExistingCompany>();
  const byName = new Map<string, ExistingCompany>();
  for (const c of found) {
    if (c.domain) byDomain.set(c.domain, c);
    if (c.name) byName.set(normName(c.name), c);
  }
  const matchedCompanies = new Set<string>();

  const seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const keys = keysOf(row);
    if (keys.some((k) => known.has(k))) {
      result.skippedExisting++;
      continue;
    }
    if (keys.some((k) => seen.has(k))) {
      result.skippedDuplicate++;
      continue;
    }
    keys.forEach((k) => seen.add(k));

    try {
      let companyId: string | null = null;
      if (row.companyDomain || row.companyName) {
        const match =
          (row.companyDomain && byDomain.get(row.companyDomain)) || (!row.companyDomain && row.companyName ? byName.get(normName(row.companyName)) : undefined);
        if (match) {
          companyId = match.id;
          if (!matchedCompanies.has(match.id)) {
            matchedCompanies.add(match.id);
            result.companiesMatched++;
          }
        } else {
          companyId = await store.createCompany(companyPayload(row));
          const created = { id: companyId, name: row.companyName, domain: row.companyDomain };
          if (row.companyDomain) byDomain.set(row.companyDomain, created);
          if (row.companyName) byName.set(normName(row.companyName), created);
          matchedCompanies.add(companyId);
          result.companiesCreated++;
        }
      }
      await store.createPerson(personPayload(row, companyId));
      result.created++;
    } catch (error) {
      result.failed.push({ row: i + 1, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
};
