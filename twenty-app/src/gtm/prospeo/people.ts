import { headcountLabel } from 'src/gtm/leadfinder/headcount';

// Pure helpers: search input -> Prospeo filters, Prospeo results -> plain
// person/company fields. No I/O here so they can be unit tested.
// Ported from lib/lead-finder/prospeo/people.ts in the Next.js app.

/** Prospeo returns at most 25 people per search page. */
export const PROSPEO_PAGE_SIZE = 25;
/** Upper bound on pages per findLeads run. */
export const MAX_SEARCH_PAGES = 10;

type Obj = Record<string, unknown>;

/** Accepts an array or a comma-separated string; drops blanks and duplicates. */
export function toList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v ?? '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function include(values: string[]) {
  return values.length > 0 ? { include: values } : undefined;
}

/** Strip scheme, www and path so Prospeo (and Twenty) get bare domains. */
export function toDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .toLowerCase();
}

export type LeadSearchInput = {
  jobTitles?: unknown;
  industries?: unknown;
  /** Person locations, e.g. "United Kingdom" or "London, England". */
  locations?: unknown;
  /** Headcount labels ("51-100") or ICP select values ("SIZE_51_100"). */
  headcount?: unknown;
  seniority?: unknown;
  companyWebsites?: unknown;
};

/**
 * Build Prospeo search-person filters. Throws when no filter is set, since
 * Prospeo rejects an empty search.
 */
export function buildSearchFilters(input: LeadSearchInput): Obj {
  const websites = toList(input.companyWebsites).map(toDomain).filter(Boolean).slice(0, 500);
  const jobTitles = toList(input.jobTitles);
  const headcount = toList(input.headcount)
    .map((h) => headcountLabel(h))
    .filter((h): h is NonNullable<typeof h> => h !== null);

  const filters: Obj = {
    person_job_title: jobTitles.length > 0 ? { include: jobTitles, match_mode: 'CONTAINS' } : undefined,
    person_seniority: include(toList(input.seniority)),
    person_location_search: include(toList(input.locations)),
    company_industry: include(toList(input.industries)),
    // Prospeo takes headcount ranges as a plain array, not {include: [...]}.
    company_headcount_range: headcount.length > 0 ? [...new Set(headcount)] : undefined,
    company: websites.length > 0 ? { websites: { include: websites } } : undefined,
  };
  for (const key of Object.keys(filters)) {
    if (filters[key] === undefined) delete filters[key];
  }
  if (Object.keys(filters).length === 0) {
    throw new Error('Add at least one search filter, such as job titles or an industry');
  }
  return filters;
}

/** Clamp a requested page number to 1..1000 (Prospeo's limit). */
export function clampPage(value: unknown): number {
  const n = Number(value ?? 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 1000);
}

/** Clamp the number of pages to fetch to 1..MAX_SEARCH_PAGES. */
export function clampPageCount(value: unknown): number {
  const n = Number(value ?? 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_SEARCH_PAGES);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function locationString(v: unknown): string | undefined {
  if (typeof v === 'string') return str(v);
  if (v && typeof v === 'object') {
    const o = v as Obj;
    const parts = [str(o.city), str(o.state), str(o.country)].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : undefined;
  }
  return undefined;
}

export type ProspeoPersonFields = {
  personId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  seniority?: string;
  location?: string;
  linkedinUrl?: string;
  /** Only set when Prospeo has already revealed the email (search results are usually masked). */
  email?: string;
  companyName?: string;
  companyDomain?: string;
  companyIndustry?: string;
  companyHeadcount?: string;
  companyLinkedinUrl?: string;
};

/** Prospeo results nest `person` and `company`; key names vary slightly by endpoint. */
export function personFields(result: Obj): ProspeoPersonFields {
  const person = (result.person ?? {}) as Obj;
  const company = (result.company ?? {}) as Obj;
  const first = str(person.first_name);
  const last = str(person.last_name);
  const email = person.email as Obj | string | undefined;
  const revealedEmail =
    typeof email === 'string'
      ? email.includes('*') ? undefined : str(email)
      : email && email.revealed !== false && typeof email.email === 'string' && !email.email.includes('*')
        ? str(email.email)
        : undefined;
  const website = str(company.website) ?? str(company.domain);
  const headcount = company.headcount_range ?? company.employee_range ?? company.employee_count;
  return {
    personId: str(person.person_id),
    firstName: first,
    lastName: last,
    fullName: str(person.full_name) ?? ([first, last].filter(Boolean).join(' ') || undefined),
    jobTitle: str(person.current_job_title) ?? str(person.job_title),
    seniority: str(person.seniority),
    location: locationString(person.location),
    linkedinUrl: str(person.linkedin_url),
    email: revealedEmail?.toLowerCase(),
    companyName: str(company.name) ?? str(company.company_name),
    companyDomain: website ? toDomain(website) || undefined : undefined,
    companyIndustry: str(company.industry),
    companyHeadcount: typeof headcount === 'number' ? String(headcount) : str(headcount),
    companyLinkedinUrl: str(company.linkedin_url),
  };
}

/**
 * Identify a Twenty person to Prospeo's enrich-person: the Prospeo person id
 * when the lead came from search, else LinkedIn URL, else name plus company.
 * Returns null when there is not enough to go on.
 */
export function enrichDatapoints(person: {
  prospeoPersonId?: string | null;
  linkedinUrl?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  email?: string | null;
}): Obj | null {
  const personId = str(person.prospeoPersonId);
  if (personId) return { person_id: personId };
  const linkedin = str(person.linkedinUrl);
  const name = str(person.fullName);
  const website = person.companyDomain ? toDomain(person.companyDomain) || undefined : undefined;
  const companyName = str(person.companyName);
  if (linkedin) {
    return {
      linkedin_url: linkedin,
      ...(name ? { full_name: name } : {}),
      ...(companyName ? { company_name: companyName } : {}),
      ...(website ? { company_website: website } : {}),
    };
  }
  if (name && (website || companyName)) {
    return {
      full_name: name,
      ...(website ? { company_website: website } : {}),
      ...(companyName ? { company_name: companyName } : {}),
    };
  }
  const email = str(person.email);
  if (email) return { email };
  return null;
}

/** Pull the revealed email and mobile out of an enrich-person response. */
export function enrichedContact(response: Obj): {
  personId?: string;
  email?: string;
  mobile?: string;
  emailVerified: boolean;
} {
  const person = (response.person ?? {}) as Obj;
  const email = (person.email ?? {}) as Obj;
  const mobile = (person.mobile ?? {}) as Obj;
  return {
    personId: str(person.person_id),
    email: str(email.email)?.toLowerCase(),
    mobile: str(mobile.mobile),
    emailVerified: email.status === 'VERIFIED',
  };
}
