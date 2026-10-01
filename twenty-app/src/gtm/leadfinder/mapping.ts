import type { ProspeoPersonFields } from 'src/gtm/prospeo/people';
import type { IcpCriteria, LeadProfile, ScoreResult } from 'src/gtm/leadfinder/scoring';

// Pure mapping between Prospeo results, Twenty REST records and the scorer.

type Obj = Record<string, unknown>;

/** Twenty company create payload from a Prospeo result. Null without a company name. */
export function companyPayloadFromProspeo(f: ProspeoPersonFields): Obj | null {
  if (!f.companyName) return null;
  return dropUndefined({
    name: f.companyName,
    domainName: f.companyDomain ? { primaryLinkUrl: `https://${f.companyDomain}` } : undefined,
    linkedinLink: f.companyLinkedinUrl ? { primaryLinkUrl: f.companyLinkedinUrl } : undefined,
    industry: f.companyIndustry,
    headcountRange: f.companyHeadcount,
  });
}

/** Twenty person create payload for a new Prospeo lead. */
export function personPayloadFromProspeo(
  f: ProspeoPersonFields,
  opts: { companyId?: string | null; score?: ScoreResult | null } = {},
): Obj {
  const { firstName, lastName } = nameParts(f);
  return dropUndefined({
    name: { firstName, lastName },
    jobTitle: f.jobTitle,
    location: f.location,
    linkedinLink: f.linkedinUrl ? { primaryLinkUrl: f.linkedinUrl } : undefined,
    emails: f.email ? { primaryEmail: f.email } : undefined,
    prospeoPersonId: f.personId,
    leadSource: 'PROSPEO',
    leadStatus: 'NEW',
    companyId: opts.companyId ?? undefined,
    leadScore: opts.score?.score,
    icpGrade: opts.score?.grade,
  });
}

function nameParts(f: ProspeoPersonFields): { firstName: string; lastName: string } {
  if (f.firstName || f.lastName) return { firstName: f.firstName ?? '', lastName: f.lastName ?? '' };
  const full = (f.fullName ?? '').trim();
  const i = full.lastIndexOf(' ');
  return i === -1 ? { firstName: full, lastName: '' } : { firstName: full.slice(0, i), lastName: full.slice(i + 1) };
}

/** The scorer's view of a Prospeo result (used before the person exists in Twenty). */
export function leadProfileFromProspeo(f: ProspeoPersonFields): LeadProfile {
  return {
    jobTitle: f.jobTitle,
    industry: f.companyIndustry,
    location: f.location,
    headcount: f.companyHeadcount,
  };
}

export type TwentyPersonRecord = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  jobTitle?: string | null;
  location?: string | null;
  city?: string | null;
  emails?: { primaryEmail?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null } | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  prospeoPersonId?: string | null;
  leadScore?: number | null;
  icpGrade?: string | null;
  companyId?: string | null;
  company?: TwentyCompanyRecord | null;
};

export type TwentyCompanyRecord = {
  id: string;
  name?: string | null;
  domainName?: { primaryLinkUrl?: string | null } | null;
  industry?: string | null;
  headcountRange?: string | null;
  employees?: number | null;
  address?: { addressCity?: string | null; addressCountry?: string | null } | null;
};

/** The scorer's view of a Twenty person (with its company, depth=1). */
export function leadProfileFromPerson(person: TwentyPersonRecord): LeadProfile {
  const company = person.company ?? null;
  const companyLocation = [company?.address?.addressCity, company?.address?.addressCountry]
    .filter(Boolean)
    .join(', ');
  return {
    jobTitle: person.jobTitle ?? null,
    industry: company?.industry ?? null,
    location: person.location || person.city || companyLocation || null,
    headcount: company?.headcountRange || company?.employees || null,
  };
}

export type TwentyIcpRecord = {
  id: string;
  name?: string | null;
  jobTitles?: string[] | null;
  industries?: string[] | null;
  locations?: string[] | null;
  headcount?: string[] | null;
  isActive?: boolean | null;
};

export function icpCriteria(icp: TwentyIcpRecord): IcpCriteria {
  return {
    id: icp.id,
    name: icp.name ?? null,
    jobTitles: icp.jobTitles ?? [],
    industries: icp.industries ?? [],
    locations: icp.locations ?? [],
    headcount: icp.headcount ?? [],
  };
}

/** Fields to write back after scoring, or null when nothing would change (avoids event loops). */
export function scoreUpdate(person: Pick<TwentyPersonRecord, 'leadScore' | 'icpGrade'>, result: ScoreResult | null): Obj | null {
  if (!result) return null;
  if (person.leadScore === result.score && person.icpGrade === result.grade) return null;
  return { leadScore: result.score, icpGrade: result.grade };
}

export function fullName(person: TwentyPersonRecord): string {
  return [person.name?.firstName, person.name?.lastName].filter(Boolean).join(' ').trim();
}

function dropUndefined(o: Obj): Obj {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));
}
