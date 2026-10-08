// What qualification reads and writes, so the logic can be tested with fakes.
// The Twenty implementation is in twenty-store.ts.

import type { IcpBrief } from 'src/gtm/qualify/classify';
import type { IcpFilters } from 'src/gtm/qualify/gate';
import type { EmailStatus } from 'src/gtm/qualify/values';

export type QualifyIcp = IcpBrief & IcpFilters & { id: string };

export type QualifyPerson = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  location?: string | null;
  leadStatus?: string | null;
  emailStatus?: EmailStatus | null;
  prospeoPersonId?: string | null;
  companyId?: string | null;
};

export type QualifyCompany = {
  id: string;
  name?: string | null;
  domain?: string | null;
  industry?: string | null;
  headcount?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  agencyConfidence?: number | null;
  agencyType?: string | null;
  classificationReason?: string | null;
  // Set once the company has been researched and classified (or tried).
  researchedAt?: string | null;
};

export type QualifyStore = {
  activeIcp(): Promise<QualifyIcp | null>;
  pendingPeople(limit: number): Promise<QualifyPerson[]>;
  // Qualified (by the gates or by hand), best score first.
  qualifiedPeople(limit: number): Promise<QualifyPerson[]>;
  companies(ids: string[]): Promise<QualifyCompany[]>;
  enrollmentCounts(personIds: string[]): Promise<Map<string, number>>;
  blockedHandles(): Promise<Set<string>>;
  ownDomains(): Promise<Set<string>>;
  personIdByEmail(email: string): Promise<string | null>;
  updateCompany(id: string, data: Record<string, unknown>): Promise<void>;
  updatePerson(id: string, data: Record<string, unknown>): Promise<void>;
  // Small key-value store for the title cache and the daily verification count.
  kvGet<T>(key: string): Promise<T | null>;
  kvSet<T>(key: string, value: T): Promise<void>;
};

// Import side.
export type ExistingPerson = {
  id: string;
  email?: string | null;
  sourceRecordId?: string | null;
  linkedinUrl?: string | null;
  prospeoPersonId?: string | null;
};

export type ExistingCompany = { id: string; name?: string | null; domain?: string | null };

export type ImportStore = {
  findPeople(keys: { emails: string[]; sourceRecordIds: string[]; linkedinUrls: string[]; prospeoIds: string[] }): Promise<ExistingPerson[]>;
  findCompanies(keys: { domains: string[]; names: string[] }): Promise<ExistingCompany[]>;
  createCompany(data: Record<string, unknown>): Promise<string>;
  createPerson(data: Record<string, unknown>): Promise<string>;
};
