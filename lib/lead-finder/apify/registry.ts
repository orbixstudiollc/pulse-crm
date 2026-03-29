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
