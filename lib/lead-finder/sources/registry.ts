import type { ActorDefinition, ActorPhase } from "../types";

// =============================================================================
// Lead Finder data sources. Prospeo finds and enriches B2B people; the website
// source reads the company homepage for AI personalization.
//
// Campaigns store selected source ids in `lf_campaigns.apify_actors` and their
// inputs in `actor_configs` (column names predate the move off Apify).
// =============================================================================

export type { ActorDefinition, ActorPhase, InputFieldDescription } from "../types";

export const PROSPEO_SEARCH = "prospeo/search-person";
export const PROSPEO_ENRICH_EMAIL = "prospeo/enrich-person";
export const PROSPEO_ENRICH_MOBILE = "prospeo/enrich-mobile";
export const WEBSITE_CONTENT = "web/website-content";

/** Valid Prospeo values, shown as help text so the planner and users pick real ones. */
export const PROSPEO_SENIORITIES = [
  "C-Suite", "Director", "Entry", "Founder/Owner", "Head", "Intern",
  "Manager", "Partner", "Senior", "Vice President",
] as const;

export const PROSPEO_HEADCOUNTS = [
  "1-10", "11-20", "21-50", "51-100", "101-200", "201-500",
  "501-1000", "1001-2000", "2001-5000", "5001-10000", "10000+",
] as const;

export const PROSPEO_DEPARTMENTS = [
  "C-Suite", "Consulting", "Design", "Education & Coaching", "Engineering & Technical",
  "Finance", "Human Resources", "Information Technology", "Legal", "Marketing",
  "Medical & Health", "Operations", "Product", "Sales",
] as const;

export const SOURCE_REGISTRY: ActorDefinition[] = [
  {
    id: PROSPEO_SEARCH,
    name: "Prospeo People Search",
    category: "lead-generation",
    phase: "find",
    description:
      "Find B2B decision-makers by job title, seniority, department, location, industry and company size. 25 people per page, 1 Prospeo credit per page.",
    requiredInputFields: [],
    pageLimitKey: "max_pages",
    defaultInput: { max_pages: 2 },
    inputFieldDescriptions: {
      job_titles: {
        label: "Job titles",
        placeholder: "Head of Sales, VP Marketing",
        type: "string-array",
        helpText: "Comma-separated. Matches titles that contain any of these.",
      },
      seniority: {
        label: "Seniority",
        placeholder: "Founder/Owner, C-Suite",
        type: "string-array",
        helpText: `Any of: ${PROSPEO_SENIORITIES.join(", ")}`,
      },
      departments: {
        label: "Departments",
        placeholder: "Sales, Marketing",
        type: "string-array",
        helpText: `Any of: ${PROSPEO_DEPARTMENTS.join(", ")}`,
      },
      person_locations: {
        label: "Person location",
        placeholder: "United States, London",
        type: "string-array",
        helpText: "Countries, regions or cities where the person is based.",
      },
      industries: {
        label: "Company industry",
        placeholder: "Software Development, Marketing Services",
        type: "string-array",
        helpText: "LinkedIn-style industry names.",
      },
      headcount: {
        label: "Company size",
        placeholder: "11-20, 21-50",
        type: "string-array",
        helpText: `Any of: ${PROSPEO_HEADCOUNTS.join(", ")}`,
      },
      company_locations: {
        label: "Company location",
        placeholder: "Germany",
        type: "string-array",
        helpText: "Where the company is headquartered.",
      },
      technologies: {
        label: "Company uses",
        placeholder: "HubSpot, Shopify",
        type: "string-array",
        helpText: "Technologies on the company's stack.",
      },
      company_websites: {
        label: "Only these companies",
        placeholder: "acme.com, globex.com",
        type: "string-array",
        helpText: "Account list for ABM. Up to 500 domains.",
      },
      max_pages: {
        label: "Pages",
        placeholder: "2",
        type: "number",
        helpText: "25 people per page. Each page with results costs 1 credit.",
      },
    },
  },
  {
    id: PROSPEO_ENRICH_EMAIL,
    name: "Prospeo Email Finder",
    category: "outreach-intel",
    phase: "enrich",
    description: "Finds the person's verified work email. 1 credit when found, free when not.",
    requiredInputFields: [],
  },
  {
    id: PROSPEO_ENRICH_MOBILE,
    name: "Prospeo Mobile Finder",
    category: "outreach-intel",
    phase: "enrich",
    description: "Finds a verified mobile number and work email. 10 credits when found.",
    requiredInputFields: [],
  },
  {
    id: WEBSITE_CONTENT,
    name: "Company Website",
    category: "enrichment",
    phase: "enrich",
    description: "Reads the company homepage so the AI can personalize outreach. Free.",
    requiredInputFields: [],
  },
];

/** Default enrichment when a campaign selects none: email plus website. */
export const DEFAULT_ENRICH_SOURCES = [PROSPEO_ENRICH_EMAIL, WEBSITE_CONTENT];

export function getSourceById(id: string): ActorDefinition | undefined {
  return SOURCE_REGISTRY.find((s) => s.id === id);
}

export function getSourcesByPhase(phase: ActorPhase): ActorDefinition[] {
  return SOURCE_REGISTRY.filter((s) => s.phase === phase);
}

export function isFindSource(id: string): boolean {
  return getSourceById(id)?.phase === "find";
}

export function isEnrichSource(id: string): boolean {
  return getSourceById(id)?.phase === "enrich";
}
