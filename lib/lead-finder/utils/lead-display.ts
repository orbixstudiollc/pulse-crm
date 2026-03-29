// =============================================================================
// Lead Display utilities – pure functions, no DB calls
// =============================================================================

import type { LFLead, LeadStatus, CampaignStatus } from "../types";

/**
 * Get a human-readable display name for a lead.
 * Falls back through multiple fields if display_name is empty.
 */
export function getLeadDisplayName(lead: LFLead): string {
  if (lead.display_name) return lead.display_name;
  if (lead.email) return lead.email;
  if (lead.website) return cleanDomain(lead.website);
  if (lead.phone) return lead.phone;
  return "Unknown Lead";
}

/**
 * Get initials from a lead's display name (for avatar fallbacks).
 */
export function getLeadInitials(lead: LFLead): string {
  const name = getLeadDisplayName(lead);
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (
    words[0].charAt(0) + words[words.length - 1].charAt(0)
  ).toUpperCase();
}

/**
 * Clean a URL into a readable domain name.
 */
export function cleanDomain(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  }
}

/**
 * Format a lead source actor ID into a human-readable label.
 */
export function formatSource(source: string): string {
  const labels: Record<string, string> = {
    "apify/google-maps-scraper": "Google Maps",
    "apify/yelp-scraper": "Yelp",
    "apify/instagram-scraper": "Instagram",
    "curious_coder/linkedin-sales-navigator-search": "LinkedIn Sales Nav",
    "code_crafter/leads-finder": "Leads Finder",
    "apify/google-search-scraper": "Google Search",
    "apify/website-content-crawler": "Website Crawler",
    "apify/contact-info-scraper": "Contact Scraper",
    "apify/social-media-scraper": "Social Media",
  };

  return labels[source] || source.split("/").pop()?.replace(/-/g, " ") || source;
}

/**
 * Get a status badge color class for a lead status.
 */
export function getStatusColor(status: LeadStatus): string {
  const colors: Record<LeadStatus, string> = {
    new: "bg-blue-100 text-blue-800",
    enriching: "bg-yellow-100 text-yellow-800",
    qualified: "bg-green-100 text-green-800",
    converted: "bg-purple-100 text-purple-800",
    declined: "bg-red-100 text-red-800",
    archived: "bg-gray-100 text-gray-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

/**
 * Get a status badge color class for a campaign status.
 */
export function getCampaignStatusColor(status: CampaignStatus): string {
  const colors: Record<CampaignStatus, string> = {
    draft: "bg-gray-100 text-gray-800",
    active: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    completed: "bg-blue-100 text-blue-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

/**
 * Get a human-readable label for a lead status.
 */
export function getStatusLabel(status: LeadStatus): string {
  const labels: Record<LeadStatus, string> = {
    new: "New",
    enriching: "Enriching",
    qualified: "Qualified",
    converted: "Converted",
    declined: "Declined",
    archived: "Archived",
  };
  return labels[status] || status;
}

/**
 * Format a score as a visual indicator (e.g., for sorting, badges).
 */
export function getScoreLevel(
  score: number
): "high" | "medium" | "low" | "none" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  if (score > 0) return "low";
  return "none";
}

/**
 * Get a color class for a score value.
 */
export function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  if (score > 0) return "text-red-600";
  return "text-gray-400";
}

/**
 * Format USD cost with appropriate precision.
 */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Format token count for display.
 */
export function formatTokens(count: number): string {
  if (count === 0) return "0";
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1_000_000).toFixed(2)}M`;
}

/**
 * Calculate total costs for a lead (LLM + Apify).
 */
export function getTotalLeadCost(lead: LFLead): number {
  return (
    (lead.llm_cost_usd || 0) +
    (lead.apify_cost_usd || 0) +
    (lead.discovery_llm_cost_usd || 0) +
    (lead.discovery_apify_cost_usd || 0)
  );
}

/**
 * Summarize data completeness as a percentage.
 */
export function getDataCompleteness(lead: LFLead): number {
  const fields = [
    lead.display_name,
    lead.email,
    lead.phone,
    lead.website,
  ];
  const filled = fields.filter((f) => f && String(f).trim()).length;
  return Math.round((filled / fields.length) * 100);
}
