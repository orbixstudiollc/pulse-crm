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
    id: "apify/google-maps-scraper",
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
    id: "apify/yelp-scraper",
    name: "Yelp Scraper",
    category: "lead-generation",
    phase: "find",
    description:
      "Scrape Yelp business listings by search term and location. Returns name, phone, website, rating, reviews.",
    requiredInputFields: ["searchTerms"],
    inputFieldDescriptions: {
      searchTerms: {
        label: "Search Terms",
        placeholder: '["restaurants", "dentists"]',
        type: "string-array",
        helpText: "What type of business to search for on Yelp.",
      },
      locations: {
        label: "Locations",
        placeholder: '["New York, NY", "Los Angeles, CA"]',
        type: "string-array",
        helpText: "Locations to search.",
      },
      maxItems: {
        label: "Max Results",
        placeholder: "50",
        type: "number",
        helpText: "Maximum listings to return.",
      },
    },
    defaultInput: {
      searchTerms: [],
      locations: [],
      maxItems: 50,
    },
    pageLimitKey: "maxItems",
  },
  {
    id: "apify/instagram-scraper",
    name: "Instagram Scraper",
    category: "social",
    phase: "find",
    description:
      "Scrape Instagram profiles by username or search keyword. Returns bio, followers, email (business accounts), and website.",
    requiredInputFields: [],
    inputFieldDescriptions: {
      directUrls: {
        label: "Profile URLs / Usernames",
        placeholder:
          '["https://www.instagram.com/example/", "@another_user"]',
        type: "string-array",
        helpText:
          "Instagram profile URLs or @usernames to scrape directly.",
      },
      search: {
        label: "Search Query",
        placeholder: "fitness coach",
        type: "string",
        helpText:
          "Search keyword to find profiles (alternative to direct URLs).",
      },
      searchType: {
        label: "Search Type",
        placeholder: "user",
        type: "string",
        helpText: 'Type of search: "user", "hashtag", or "place".',
      },
      resultsLimit: {
        label: "Results Limit",
        placeholder: "20",
        type: "number",
        helpText: "Max results to return.",
      },
    },
    defaultInput: {
      resultsType: "details",
      resultsLimit: 20,
    },
    pageLimitKey: "resultsLimit",
  },
  {
    id: "curious_coder/linkedin-sales-navigator-search",
    name: "LinkedIn Sales Navigator Search",
    category: "social",
    phase: "find",
    description:
      "Scrape LinkedIn Sales Navigator search results. Requires a Sales Navigator URL and session cookie.",
    requiredInputFields: ["searchUrl"],
    inputFieldDescriptions: {
      searchUrl: {
        label: "Sales Navigator Search URL",
        placeholder:
          "https://www.linkedin.com/sales/search/people?query=...",
        type: "string",
        helpText:
          "Full Sales Navigator search URL with your filters applied.",
      },
      cookie: {
        label: "Session Cookies",
        placeholder: '[{"name":"li_at","value":"..."}]',
        type: "string-array",
        helpText: "LinkedIn session cookies (li_at at minimum).",
      },
      count: {
        label: "Max Leads",
        placeholder: "50",
        type: "number",
        helpText: "Maximum number of leads to scrape.",
      },
    },
    defaultInput: {
      deepScrape: true,
      count: 50,
      minDelay: 5,
      maxDelay: 30,
    },
    pageLimitKey: "count",
  },
  {
    id: "code_crafter/leads-finder",
    name: "Leads Finder (Multi-source)",
    category: "lead-generation",
    phase: "find",
    description:
      "Find leads from multiple sources by job title, company, and location. Combines data from several providers.",
    requiredInputFields: ["queries"],
    inputFieldDescriptions: {
      queries: {
        label: "Search Queries",
        placeholder: '["CEO at tech startups in Austin"]',
        type: "string-array",
        helpText: "Natural-language queries for lead search.",
      },
      maxResults: {
        label: "Max Results",
        placeholder: "50",
        type: "number",
        helpText: "Max leads to return.",
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
      countryCode: "us",
    },
    pageLimitKey: "maxPagesPerQuery",
  },

  // ── Enrich-phase actors ──────────────────────────────────────────────────
  {
    id: "apify/website-content-crawler",
    name: "Website Content Crawler",
    category: "enrichment",
    phase: "enrich",
    description:
      "Crawl a website and extract text content, tech stack, and metadata. Used to enrich leads with company information.",
    requiredInputFields: ["startUrls"],
    inputFieldDescriptions: {
      startUrls: {
        label: "Website URLs",
        placeholder: '["https://example.com"]',
        type: "string-array",
        helpText: "URLs to crawl.",
      },
      maxCrawlPages: {
        label: "Max Pages",
        placeholder: "10",
        type: "number",
        helpText: "Maximum pages to crawl per site.",
      },
    },
    defaultInput: {
      startUrls: [],
      maxCrawlPages: 10,
      crawlerType: "cheerio",
    },
    pageLimitKey: "maxCrawlPages",
  },
  {
    id: "apify/contact-info-scraper",
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
    id: "apify/social-media-scraper",
    name: "Social Media Profile Scraper",
    category: "social",
    phase: "enrich",
    description:
      "Scrape social media profiles (Facebook, Twitter/X, LinkedIn) for enrichment data.",
    requiredInputFields: ["urls"],
    inputFieldDescriptions: {
      urls: {
        label: "Profile URLs",
        placeholder:
          '["https://facebook.com/example", "https://twitter.com/example"]',
        type: "string-array",
        helpText: "Social media profile URLs to scrape.",
      },
    },
    defaultInput: {
      urls: [],
    },
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
      "Find local businesses via Google Maps, then enrich with website data and contact info.",
    actors: [
      "apify/google-maps-scraper",
      "apify/website-content-crawler",
      "apify/contact-info-scraper",
    ],
  },
  {
    id: "social-outreach",
    label: "Social Media Outreach",
    description:
      "Find leads on Instagram or LinkedIn, then enrich with website and social data.",
    actors: [
      "apify/instagram-scraper",
      "apify/website-content-crawler",
      "apify/social-media-scraper",
    ],
  },
  {
    id: "b2b-prospecting",
    label: "B2B Prospecting",
    description:
      "Find B2B leads via Google Search and Leads Finder, enrich with company website data.",
    actors: [
      "apify/google-search-scraper",
      "code_crafter/leads-finder",
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
