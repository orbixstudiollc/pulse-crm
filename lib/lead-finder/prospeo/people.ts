import type { NewLFLead } from "../types";

// =============================================================================
// Pure helpers: campaign input -> Prospeo filters, Prospeo results -> leads.
// No I/O here so they can be unit tested.
// =============================================================================

/** Prospeo returns at most 25 people per search page. */
export const PROSPEO_PAGE_SIZE = 25;
/** Upper bound on pages per discovery run, whatever the campaign asks for. */
export const MAX_SEARCH_PAGES = 20;

type Obj = Record<string, unknown>;

/** Accepts an array or a comma-separated string; drops blanks and duplicates. */
export function toList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v ?? "").trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function include(values: string[]) {
  return values.length > 0 ? { include: values } : undefined;
}

/** Strip scheme, www and path so Prospeo gets bare domains. */
export function toDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

/**
 * Build Prospeo search-person filters from a campaign's source input.
 * Throws when no filter is set, since Prospeo rejects an empty search.
 */
export function buildSearchFilters(input: Obj): Obj {
  const websites = toList(input.company_websites).map(toDomain).filter(Boolean).slice(0, 500);
  const jobTitles = toList(input.job_titles);

  const filters: Obj = {
    person_job_title: jobTitles.length > 0 ? { include: jobTitles, match_mode: "CONTAINS" } : undefined,
    person_seniority: include(toList(input.seniority)),
    person_department: include(toList(input.departments)),
    person_location_search: include(toList(input.person_locations)),
    company_industry: include(toList(input.industries)),
    company_headcount_range: include(toList(input.headcount)),
    company_location_search: include(toList(input.company_locations)),
    company_technology: include(toList(input.technologies)),
    company: websites.length > 0 ? { websites: { include: websites } } : undefined,
  };
  for (const key of Object.keys(filters)) {
    if (filters[key] === undefined) delete filters[key];
  }
  if (Object.keys(filters).length === 0) {
    throw new Error("Add at least one search filter, such as job titles or an industry");
  }
  return filters;
}

/** Number of search pages to fetch, clamped to 1..MAX_SEARCH_PAGES. */
export function pagesToFetch(input: Obj, campaignMaxPages?: number | null): number {
  const requested = Number(input.max_pages ?? campaignMaxPages ?? 1);
  if (!Number.isFinite(requested) || requested < 1) return 1;
  return Math.min(Math.floor(requested), MAX_SEARCH_PAGES);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Prospeo search results nest `person` and `company`; key names vary slightly by endpoint. */
export function personFields(result: Obj) {
  const person = (result.person ?? {}) as Obj;
  const company = (result.company ?? {}) as Obj;
  const first = str(person.first_name);
  const last = str(person.last_name);
  const location = person.location;
  const companyLocation = company.location;
  return {
    personId: str(person.person_id),
    firstName: first,
    lastName: last,
    fullName: str(person.full_name) ?? ([first, last].filter(Boolean).join(" ") || undefined),
    jobTitle: str(person.current_job_title) ?? str(person.job_title),
    seniority: str(person.seniority),
    department: str(person.department),
    location: str(location) ?? str((location as Obj | undefined)?.country),
    linkedinUrl: str(person.linkedin_url),
    companyName: str(company.name) ?? str(company.company_name),
    companyWebsite: str(company.website) ?? str(company.domain),
    companyIndustry: str(company.industry),
    companyHeadcount: str(company.headcount_range) ?? str(company.employee_range),
    companyLocation: str(companyLocation) ?? str((companyLocation as Obj | undefined)?.country),
    companyLinkedinUrl: str(company.linkedin_url),
  };
}

/** Map one search-person result to a new lf_leads row. Email and phone come later, from enrichment. */
export function searchResultToLead(
  result: Obj,
  ctx: { orgId: string; campaignId: string }
): NewLFLead {
  const f = personFields(result);
  return {
    organization_id: ctx.orgId,
    campaign_id: ctx.campaignId,
    source: "prospeo",
    display_name: f.fullName,
    website: f.companyWebsite,
    status: "new",
    raw_data: result,
    mapped_data: Object.fromEntries(
      Object.entries({
        prospeo_person_id: f.personId,
        first_name: f.firstName,
        last_name: f.lastName,
        job_title: f.jobTitle,
        seniority: f.seniority,
        department: f.department,
        location: f.location,
        linkedin_url: f.linkedinUrl,
        company_name: f.companyName,
        company_industry: f.companyIndustry,
        company_headcount: f.companyHeadcount,
        company_location: f.companyLocation,
        company_linkedin_url: f.companyLinkedinUrl,
      }).filter(([, v]) => v !== undefined)
    ),
  };
}

/**
 * Identify the person to Prospeo's enrich-person: the Prospeo person id when
 * the lead came from search, else LinkedIn URL, else name plus company.
 * Returns null when there is not enough to go on.
 */
export function enrichDatapoints(lead: {
  display_name: string | null;
  email: string | null;
  website: string | null;
  mapped_data: Obj | null;
  raw_data: Obj | null;
}): Obj | null {
  const m = lead.mapped_data ?? {};
  const personId = str(m.prospeo_person_id) ?? str(((lead.raw_data ?? {}).person as Obj | undefined)?.person_id);
  if (personId) return { person_id: personId };
  const linkedin = str(m.linkedin_url);
  if (linkedin) return { linkedin_url: linkedin };
  const name = str(lead.display_name);
  const website = lead.website ? toDomain(lead.website) : undefined;
  const companyName = str(m.company_name);
  if (name && (website || companyName)) {
    return {
      full_name: name,
      ...(website ? { company_website: website } : {}),
      ...(companyName ? { company_name: companyName } : {}),
    };
  }
  if (lead.email) return { email: lead.email };
  return null;
}

/** Pull the revealed email and mobile out of an enrich-person response. */
export function enrichedContact(response: Obj): { email?: string; mobile?: string; emailVerified: boolean } {
  const person = (response.person ?? {}) as Obj;
  const email = (person.email ?? {}) as Obj;
  const mobile = (person.mobile ?? {}) as Obj;
  return {
    email: str(email.email),
    mobile: str(mobile.mobile),
    emailVerified: email.status === "VERIFIED",
  };
}
