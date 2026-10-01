import type { Database } from "@/types/database";

export type LeadSource = Database["public"]["Enums"]["lead_source"];

/** The values the `lead_source` enum accepts, in display order. */
export const LEAD_SOURCES: readonly LeadSource[] = [
  "Website",
  "Referral",
  "LinkedIn",
  "Event",
  "Google Ads",
  "Cold Call",
];

const key = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, "");

/**
 * Maps a source from a form or older client ("referral", "google-ads",
 * "Cold Call") to its enum value. Returns null for an empty value and
 * undefined for one the enum has no match for.
 */
export function normalizeLeadSource(value: unknown): LeadSource | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  if (!value.trim()) return null;
  return LEAD_SOURCES.find((s) => key(s) === key(value));
}
