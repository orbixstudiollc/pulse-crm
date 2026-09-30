// Pure parsing of the proposals.content / proposals.pricing_tiers JSON columns.
// Shapes seen in the wild: the seed (lib/seed/generate.ts) and the AI generators
// (lib/actions/ai-proposals.ts). No React, no server imports.

export type ProposalSection = { key: string; title: string; text?: string; items?: string[] };
export type PricingTier = { name: string; price: string; features: string[]; recommended: boolean };

const KNOWN_SECTIONS: [key: string, title: string][] = [
  ["executive_summary", "Executive summary"],
  ["problem_statement", "Problem"],
  ["proposed_solution", "Proposed solution"],
  ["solution_overview", "Solution overview"],
  ["deliverables", "Deliverables"],
  ["timeline", "Timeline"],
  ["pricing_section", "Pricing"],
  ["next_steps", "Next steps"],
  ["terms", "Terms"],
];

const SKIPPED_KEYS = new Set(["title", "pricing"]);

const TIER_ORDER = ["good", "better", "best"];

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sentenceCase(key: string): string {
  const words = key.split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function toSection(key: string, title: string, value: unknown): ProposalSection | null {
  if (typeof value === "string") {
    return value.trim() ? { key, title, text: value } : null;
  }
  if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string")) {
    return { key, title, items: value as string[] };
  }
  return null;
}

export function parseProposalSections(content: unknown): ProposalSection[] {
  if (!isPlainObject(content)) return [];

  const knownKeys = new Set(KNOWN_SECTIONS.map(([key]) => key));
  const known = KNOWN_SECTIONS.map(([key, title]) => toSection(key, title, content[key]));
  const extra = Object.keys(content)
    .filter((key) => !knownKeys.has(key) && !SKIPPED_KEYS.has(key))
    .map((key) => toSection(key, sentenceCase(key), content[key]));

  return [...known, ...extra].filter((s): s is ProposalSection => s !== null);
}

function formatPrice(price: unknown): string {
  if (typeof price === "number") return `$${price.toLocaleString("en-US")}/mo`;
  if (typeof price === "string") return price;
  return "";
}

function toTier(entry: unknown): PricingTier | null {
  if (!isPlainObject(entry)) return null;
  const name = entry.name ?? entry.tier;
  if (typeof name !== "string" || !name) return null;
  return {
    name,
    price: formatPrice(entry.price),
    features: Array.isArray(entry.features)
      ? entry.features.filter((f): f is string => typeof f === "string")
      : [],
    recommended: entry.recommended === true,
  };
}

function tierEntries(source: unknown): unknown[] {
  if (Array.isArray(source)) return source;
  if (!isPlainObject(source)) return [];
  if (Array.isArray(source.tiers)) return source.tiers;
  // jsonb does not preserve key order, so pin good/better/best first, then the rest as given.
  const keys = Object.keys(source);
  const ordered = [...TIER_ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !TIER_ORDER.includes(k))];
  return ordered.map((k) => source[k]);
}

function tiersFrom(source: unknown): PricingTier[] {
  return tierEntries(source)
    .map(toTier)
    .filter((t): t is PricingTier => t !== null);
}

export function parsePricingTiers(pricingTiers: unknown, content?: unknown): PricingTier[] {
  const tiers = tiersFrom(pricingTiers);
  if (tiers.length > 0) return tiers;
  return isPlainObject(content) ? tiersFrom(content.pricing) : [];
}
