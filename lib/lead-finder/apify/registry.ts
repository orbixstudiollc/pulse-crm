// =============================================================================
// Apify Actor Registry – client-safe, no DB calls
// =============================================================================

import type {
  ActorDefinition,
  ActorCategory,
  ActorPhase,
  ActorWorkflow,
  InputFieldDescription,
} from "../types";

// Re-export for convenience
export type { ActorDefinition, ActorCategory, ActorPhase, InputFieldDescription };

// ---------------------------------------------------------------------------
// Built-in actors
// ---------------------------------------------------------------------------

export const ACTOR_REGISTRY: ActorDefinition[] = [
  // ── Find-phase actors ────────────────────────────────────────────────────
  {
    id: "compass/crawler-google-places",
    name: "Google Maps Scraper",
    category: "lead-generation",
    phase: "find",
    description:
      "Scrape Google Maps listings by search query. Returns business name, address, phone, website, rating, reviews, and more.",
    requiredInputFields: ["searchStringsArray"],
    inputFieldDescriptions: {
      searchStringsArray: {
        label: "Search Queries",
        placeholder: '["plumbers in Austin TX", "HVAC contractors Dallas"]',
        type: "string-array",
        helpText:
          "List of Google Maps search queries. Each query runs a separate search.",
      },
      locationQuery: {
        label: "Location",
        placeholder: "Austin, TX",
        type: "string",
        helpText: "Optional location context to narrow results.",
      },
      maxCrawledPlacesPerSearch: {
        label: "Max Results per Search",
        placeholder: "50",
        type: "number",
        helpText: "Maximum number of places to return per search query.",
      },
      language: {
        label: "Language",
        placeholder: "en",
        type: "string",
        helpText: "Language code for results (e.g. en, es, fr).",
      },
    },
    defaultInput: {
      searchStringsArray: [],
      maxCrawledPlacesPerSearch: 50,
      language: "en",
      scrapeContacts: true,
    },
    pageLimitKey: "maxCrawledPlacesPerSearch",
  },
  {
    id: "poidata/google-maps-email-extractor",
    name: "Google Maps Email Extractor",
    category: "lead-generation",
    phase: "find",
    description:
      "Search Google Maps and extract emails, phones, and websites from business listings in one step.",
    requiredInputFields: ["queries"],
    inputFieldDescriptions: {
      queries: {
        label: "Search Queries",
        placeholder: '["digital marketing agency", "SaaS company London"]',
        type: "string-array",
        helpText: "Google Maps search queries to find businesses.",
      },
      maxResults: {
        label: "Max Results",
        placeholder: "50",
        type: "number",
        helpText: "Maximum number of businesses to return.",
      },
    },
    defaultInput: {
      queries: [],
      maxResults: 50,
    },
    pageLimitKey: "maxResults",
  },
  {
    id: "apify/google-search-scraper",
    name: "Google Search Scraper",
    category: "search",
    phase: "find",
    description:
      "Scrape Google search results. Useful for finding company websites, directories, and niche leads.",
    requiredInputFields: ["queries"],
    inputFieldDescriptions: {
      queries: {
        label: "Search Queries",
        placeholder:
          '["best plumbers in Austin", "digital marketing agencies NYC"]',
        type: "string-array",
        helpText: "Google search queries to execute.",
      },
      maxPagesPerQuery: {
        label: "Pages per Query",
        placeholder: "3",
        type: "number",
        helpText: "Number of Google result pages to scrape per query.",
      },
      countryCode: {
        label: "Country Code",
        placeholder: "us",
        type: "string",
        helpText: "Country-specific results (e.g. us, uk, de).",
      },
    },
    defaultInput: {
      queries: [],
      maxPagesPerQuery: 3,
    },
    pageLimitKey: "maxPagesPerQuery",
  },

  // ── Enrich-phase actors ──────────────────────────────────────────────────
  {
    id: "vdrmota/contact-info-scraper",
    name: "Contact Info Scraper",
    category: "enrichment",
    phase: "enrich",
    description:
      "Extract emails, phone numbers, and social links from any website.",
    requiredInputFields: ["startUrls"],
    inputFieldDescriptions: {
      startUrls: {
        label: "Website URLs",
        placeholder: '["https://example.com"]',
        type: "string-array",
        helpText: "Websites to scan for contact information.",
      },
      maxDepth: {
        label: "Crawl Depth",
        placeholder: "2",
        type: "number",
        helpText: "How many levels deep to crawl for contacts.",
      },
    },
    defaultInput: {
      startUrls: [],
      maxDepth: 2,
    },
  },
  {
    id: "apify/facebook-pages-scraper",
    name: "Facebook Pages Scraper",
    category: "social",
    phase: "enrich",
    description:
      "Scrape Facebook business pages for contact info, website, email, phone, and about info.",
    requiredInputFields: ["startUrls"],
    inputFieldDescriptions: {
      startUrls: {
        label: "Facebook Page URLs",
        placeholder: '["https://www.facebook.com/example"]',
        type: "string-array",
        helpText: "Facebook page URLs to scrape.",
      },
    },
    defaultInput: {
      startUrls: [],
    },
  },
  {
    id: "apify/instagram-profile-scraper",
    name: "Instagram Profile Scraper",
    category: "social",
    phase: "enrich",
    description:
      "Scrape Instagram business profiles for bio, website, email, and follower data.",
    requiredInputFields: ["usernames"],
    inputFieldDescriptions: {
      usernames: {
        label: "Usernames",
        placeholder: '["example_brand", "another_company"]',
        type: "string-array",
        helpText: "Instagram usernames to scrape (without @).",
      },
    },
    defaultInput: {
      usernames: [],
    },
  },

  // ─── A. Richer website understanding ───────────────────────────────────
  {
    id: "apify/website-content-crawler",
    name: "Website Content Crawler",
    category: "enrichment",
    phase: "enrich",
    description:
      "Full-site markdown crawl of the lead's website. Produces clean, AI-friendly prose for pain-point mining, personalization summaries, and KPI extraction.",
    requiredInputFields: ["startUrls"],
    inputFieldDescriptions: {
      startUrls: {
        label: "Start URLs",
        placeholder: "https://example.com",
        type: "string-array",
        helpText:
          "Website URLs to crawl. The pipeline usually fills this from lead.website.",
      },
      maxCrawlPages: {
        label: "Max Pages Per Site",
        type: "number",
        placeholder: "10",
        helpText:
          "Cap on pages per site. 10 is a good balance of depth vs. cost.",
      },
      maxCrawlDepth: {
        label: "Max Crawl Depth",
        type: "number",
        placeholder: "2",
        helpText: "How many link-hops deep to follow from the start URL.",
      },
    },
    defaultInput: {
      maxCrawlPages: 10,
      maxCrawlDepth: 2,
      crawlerType: "playwright:adaptive",
      saveMarkdown: true,
    },
    pageLimitKey: "maxCrawlPages",
  },
  {
    id: "trudax/rag-web-browser",
    name: "RAG Web Browser",
    category: "enrichment",
    phase: "enrich",
    description:
      "Cheaper per-URL alternative to the full website crawler. Fetches a single page and returns AI-friendly markdown. Good for quick-look enrichment.",
    requiredInputFields: ["query"],
    inputFieldDescriptions: {
      query: {
        label: "Query or URL",
        placeholder: "https://example.com",
        type: "string",
        helpText:
          "A URL to fetch, or a search query. Pipeline usually fills from lead.website.",
      },
    },
    defaultInput: { maxResults: 1 },
  },

  // ─── B. Firmographics + decision-makers (LinkedIn) ────────────────────
  {
    id: "harvestapi/linkedin-company",
    name: "LinkedIn Company (HarvestAPI)",
    category: "outreach-intel",
    phase: "enrich",
    description:
      "Firmographics: employee count, HQ, industry, founded year, specialties, recent company updates. Accepts a LinkedIn URL or a plain domain.",
    requiredInputFields: ["companies"],
    inputFieldDescriptions: {
      companies: {
        label: "Companies",
        placeholder: "example.com  OR  https://linkedin.com/company/example",
        type: "string-array",
        helpText:
          "LinkedIn company URLs or bare domains. Pipeline usually fills from lead.website.",
      },
    },
    defaultInput: {},
  },
  {
    id: "harvestapi/linkedin-profile-scraper",
    name: "LinkedIn Decision-Makers (HarvestAPI)",
    category: "outreach-intel",
    phase: "enrich",
    description:
      "Pulls decision-maker profiles (name + title) for a given company. Accepts a domain or LinkedIn company URL plus target job titles.",
    requiredInputFields: ["companies"],
    inputFieldDescriptions: {
      companies: {
        label: "Companies",
        placeholder: "example.com",
        type: "string-array",
        helpText: "Domain or LinkedIn company URL to search within.",
      },
      currentJobTitles: {
        label: "Target Job Titles",
        placeholder: "CEO, Founder, Head of Marketing",
        type: "string-array",
        helpText: "Roles to look for. Leave empty to pull all profiles.",
      },
      maxItems: {
        label: "Max Profiles",
        type: "number",
        placeholder: "10",
        helpText: "Cap on profiles per company.",
      },
    },
    defaultInput: {
      currentJobTitles: ["CEO", "Founder", "Owner", "Managing Director"],
      maxItems: 10,
    },
    pageLimitKey: "maxItems",
  },

  // ─── C. Email discovery + verification ─────────────────────────────────
  {
    id: "lhotanok/email-verifier",
    name: "Email Verifier",
    category: "outreach-intel",
    phase: "enrich",
    description:
      "MX + SMTP verification for discovered emails. Flags role-based addresses and invalid mailboxes so you don't burn sender reputation.",
    requiredInputFields: ["emails"],
    inputFieldDescriptions: {
      emails: {
        label: "Emails",
        placeholder: "hello@example.com",
        type: "string-array",
        helpText:
          "Emails to verify. Pipeline fills from lead.email or rawData.emails[].",
      },
    },
    defaultInput: {},
  },
  {
    id: "scrapestorm/hunter-io-email-finder",
    name: "Hunter Email Finder",
    category: "outreach-intel",
    phase: "enrich",
    description:
      "Given a domain, returns role-based and pattern-guessed emails with confidence scores. Pair with Email Verifier for clean, send-ready contacts.",
    requiredInputFields: ["domain"],
    inputFieldDescriptions: {
      domain: {
        label: "Domain",
        placeholder: "example.com",
        type: "string",
        helpText: "Company domain. Pipeline fills from lead.website.",
      },
      firstName: {
        label: "First Name (optional)",
        placeholder: "Jane",
        type: "string",
        helpText: "Narrow the search to a specific person.",
      },
      lastName: {
        label: "Last Name (optional)",
        placeholder: "Doe",
        type: "string",
        helpText: "Narrow the search to a specific person.",
      },
    },
    defaultInput: {},
  },

  // ─── D. Trigger events + social proof ──────────────────────────────────
  {
    id: "compass/google-maps-reviews-scraper",
    name: "Google Maps Reviews",
    category: "outreach-intel",
    phase: "enrich",
    description:
      "Pulls recent Google reviews for a place. Complaints surface pain points; positive quotes become opener hooks (\"saw your 4.7★ review on…\").",
    requiredInputFields: ["startUrls"],
    inputFieldDescriptions: {
      startUrls: {
        label: "Place URLs",
        placeholder: "https://www.google.com/maps/place/...",
        type: "string-array",
        helpText:
          "Google Maps place URLs. Pipeline fills from rawData.url / rawData.placeId of leads found via Google Maps.",
      },
      maxReviews: {
        label: "Max Reviews Per Place",
        type: "number",
        placeholder: "20",
        helpText:
          "Cap on reviews per lead. 20 is usually enough for signal mining.",
      },
    },
    defaultInput: { maxReviews: 20, reviewsSort: "newest" },
    pageLimitKey: "maxReviews",
  },
  {
    id: "coder_zoro/trustpilot-scraper",
    name: "Trustpilot Reviews",
    category: "outreach-intel",
    phase: "enrich",
    description:
      "Trustpilot reviews for brands that live there (SaaS, B2C services). Same pain-point mining + social-proof opener playbook as Google Reviews.",
    requiredInputFields: ["companyNames"],
    inputFieldDescriptions: {
      companyNames: {
        label: "Company Names or Trustpilot URLs",
        placeholder: "example.com",
        type: "string-array",
        helpText: "Domain or Trustpilot business URL. Pipeline fills from lead.website.",
      },
      maxReviews: {
        label: "Max Reviews",
        type: "number",
        placeholder: "20",
        helpText: "Cap per company.",
      },
    },
    defaultInput: { maxReviews: 20 },
    pageLimitKey: "maxReviews",
  },
  {
    id: "apimaestro/linkedin-company-posts",
    name: "LinkedIn Company Posts",
    category: "outreach-intel",
    phase: "enrich",
    description:
      "Last N posts from a company's LinkedIn page. Recent activity = relevant outreach (\"saw your post on X last Tuesday\").",
    requiredInputFields: ["companyUrl"],
    inputFieldDescriptions: {
      companyUrl: {
        label: "LinkedIn Company URL",
        placeholder: "https://linkedin.com/company/example",
        type: "string",
        helpText:
          "Requires a LinkedIn company URL in rawData/mappedData. If not present, the Contact Info Scraper usually extracts it.",
      },
      maxPosts: {
        label: "Max Posts",
        type: "number",
        placeholder: "10",
        helpText: "Cap on posts per company.",
      },
    },
    defaultInput: { maxPosts: 10 },
    pageLimitKey: "maxPosts",
  },
  {
    id: "bebity/linkedin-jobs-scraper",
    name: "LinkedIn Jobs",
    category: "outreach-intel",
    phase: "enrich",
    description:
      "Active job postings = hiring signal, growth stage, and surfaced pain (they're hiring for the role because they can't do it today).",
    requiredInputFields: ["companies"],
    inputFieldDescriptions: {
      companies: {
        label: "Companies",
        placeholder: "example.com",
        type: "string-array",
        helpText: "Domain or LinkedIn company URL. Pipeline fills from lead.website.",
      },
      maxJobs: {
        label: "Max Jobs",
        type: "number",
        placeholder: "10",
        helpText: "Cap per company.",
      },
    },
    defaultInput: { maxJobs: 10 },
    pageLimitKey: "maxJobs",
  },
];

// ---------------------------------------------------------------------------
// Pre-built workflows (combinations of actors)
// ---------------------------------------------------------------------------

export const ACTOR_WORKFLOWS: ActorWorkflow[] = [
  {
    id: "local-business",
    label: "Local Business Discovery",
    description:
      "Find local businesses via Google Maps, then enrich with contact info.",
    actors: [
      "compass/crawler-google-places",
      "vdrmota/contact-info-scraper",
    ],
  },
  {
    id: "maps-email",
    label: "Google Maps Email Extraction",
    description:
      "Find businesses on Google Maps and extract emails in one step, then enrich with contact info.",
    actors: [
      "poidata/google-maps-email-extractor",
      "vdrmota/contact-info-scraper",
    ],
  },
  {
    id: "b2b-prospecting",
    label: "B2B Prospecting",
    description:
      "Find B2B leads via Google Search, enrich with contact info.",
    actors: [
      "apify/google-search-scraper",
      "vdrmota/contact-info-scraper",
    ],
  },
  {
    id: "outbound-email-ready",
    label: "Outbound Email Ready",
    description:
      "Find leads, scrape contacts, guess role-based emails, and verify deliverability before sending.",
    actors: [
      "compass/crawler-google-places",
      "vdrmota/contact-info-scraper",
      "scrapestorm/hunter-io-email-finder",
      "lhotanok/email-verifier",
    ],
  },
  {
    id: "linkedin-abm",
    label: "LinkedIn-First ABM",
    description:
      "Target accounts via Google search, enrich firmographics + pull decision-makers from LinkedIn.",
    actors: [
      "apify/google-search-scraper",
      "harvestapi/linkedin-company",
      "harvestapi/linkedin-profile-scraper",
    ],
  },
  {
    id: "review-personalization",
    label: "Review-Driven Personalization",
    description:
      "Mine customer reviews + deep site content for pain points and personalization hooks.",
    actors: [
      "compass/crawler-google-places",
      "compass/google-maps-reviews-scraper",
      "apify/website-content-crawler",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helper functions (client-safe, pure lookups)
// ---------------------------------------------------------------------------

/** Get all built-in actors. */
export function getBuiltinActors(): ActorDefinition[] {
  return ACTOR_REGISTRY;
}

/** Look up a built-in actor by ID. */
export function getBuiltinActorById(
  id: string
): ActorDefinition | undefined {
  return ACTOR_REGISTRY.find((a) => a.id === id);
}

/** Filter built-in actors by phase. */
export function getBuiltinActorsByPhase(
  phase: ActorPhase
): ActorDefinition[] {
  return ACTOR_REGISTRY.filter((a) => a.phase === phase);
}

/** Filter built-in actors by category. */
export function getBuiltinActorsByCategory(
  category: ActorCategory
): ActorDefinition[] {
  return ACTOR_REGISTRY.filter((a) => a.category === category);
}

/** Get a workflow by its ID. */
export function getWorkflowById(
  id: string
): ActorWorkflow | undefined {
  return ACTOR_WORKFLOWS.find((w) => w.id === id);
}

/** Human-readable labels for actor categories. */
export function getActorCategories(): {
  category: ActorCategory;
  label: string;
}[] {
  return [
    { category: "lead-generation", label: "Lead Generation" },
    { category: "enrichment", label: "Enrichment" },
    { category: "social", label: "Social Media" },
    { category: "search", label: "Search" },
    { category: "outreach-intel", label: "Outreach Intelligence" },
  ];
}

/** Human-readable phase label. */
export function getPhaseLabel(phase: ActorPhase): string {
  return phase === "find" ? "Find Leads" : "Enrich Leads";
}
