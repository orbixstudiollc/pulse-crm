import "server-only";

import type { NewLFLead } from "../types";
import { extractEmailsFromText } from "../utils/email";

// =============================================================================
// Normalize a raw Apify result item into a NewLFLead
// =============================================================================

/**
 * Takes a single raw item from any Apify actor dataset and normalizes it
 * into a NewLFLead object. Does NOT insert into DB – caller handles that.
 */
export function normalizeSingleItem(
  item: Record<string, unknown>,
  actorId: string,
  orgId: string,
  campaignId?: string,
  sourceRunId?: string
): NewLFLead {
  const lead: NewLFLead = {
    organization_id: orgId,
    campaign_id: campaignId,
    source: actorId,
    source_run_id: sourceRunId,
    raw_data: item,
    mapped_data: {},
    status: "new",
  };

  // ── Display name ─────────────────────────────────────────────────────
  lead.display_name =
    coalesce(item, [
      "title",
      "name",
      "fullName",
      "full_name",
      "businessName",
      "company_name",
      "companyName",
      "displayName",
      "pageName",
      "username",
    ]) ?? undefined;

  // For person-type results, try combining first/last
  if (!lead.display_name) {
    const first = coalesce(item, ["firstName", "first_name"]);
    const last = coalesce(item, ["lastName", "last_name"]);
    if (first || last) {
      lead.display_name = [first, last].filter(Boolean).join(" ");
    }
  }

  // ── Email ────────────────────────────────────────────────────────────
  lead.email =
    coalesce(item, [
      "email",
      "contactEmail",
      "businessEmail",
      "publicEmail",
      "mail",
      "emailAddress",
    ]) ?? undefined;

  // Try extracting from free text if not found
  if (!lead.email) {
    const textFields = ["description", "biography", "bio", "about"];
    for (const field of textFields) {
      const val = item[field];
      if (typeof val === "string") {
        const emails = extractEmailsFromText(val);
        if (emails.length > 0) {
          lead.email = emails[0];
          break;
        }
      }
    }
  }

  // ── Phone ────────────────────────────────────────────────────────────
  lead.phone =
    coalesce(item, [
      "phone",
      "phoneUnformatted",
      "internationalPhone",
      "phoneNumber",
      "businessPhoneNumber",
      "contactPhoneNumber",
      "publicPhoneNumber",
    ]) ?? undefined;

  // Handle phone arrays
  if (!lead.phone && Array.isArray(item.phones) && item.phones.length > 0) {
    lead.phone = String(item.phones[0]);
  }

  // ── Website ──────────────────────────────────────────────────────────
  lead.website =
    coalesce(item, [
      "website",
      "webUrl",
      "externalUrl",
      "external_url",
      "companyUrl",
      "companyWebsite",
      "company_domain",
      "domain",
      "websiteLink",
    ]) ?? undefined;

  return lead;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the first truthy string found under any of the given keys. */
function coalesce(
  obj: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return undefined;
}
