// Pure CSV-row → lead mapping shared by the import server actions and their tests.
import type { Database } from "@/types/database";

export type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

export const VALID_LEAD_FIELDS = [
  "name",
  "email",
  "company",
  "phone",
  "status",
  "source",
  "industry",
  "employees",
  "website",
  "estimated_value",
  "location",
  "linkedin",
  "twitter",
  "facebook",
  "instagram",
  "title",
  "pain_points",
  "trigger_event",
  "timezone",
  "preferred_language",
  "tags",
  "revenue_range",
  "tech_stack",
  "funding_stage",
  "decision_role",
  "current_solution",
  "referred_by",
  "personal_note",
  "birthday",
  "content_interests",
  "meeting_preference",
  "assistant_name",
  "assistant_email",
] as const;

// Fields that should be parsed as arrays from comma-separated strings
export const ARRAY_FIELDS = ["tags", "content_interests"] as const;

/** Rows per importLeadRows call; the modal sends batches of this size. */
export const IMPORT_BATCH_ROWS = 500;
export const IMPORT_MAX_HEADERS = 200;
export const IMPORT_MAX_CELL_CHARS = 10_000;
/** Anonymous (guest) workspaces may hold at most this many leads. */
export const GUEST_MAX_LEADS = 1000;

export function mapRowToLead(
  headers: string[],
  row: string[],
  mapping: Record<string, string>,
  orgId: string,
): { lead: LeadInsert } | { error: string } {
  const lead: Record<string, unknown> & { organization_id: string; name?: string; email?: string } = {
    organization_id: orgId,
    status: "cold",
    source: "Website",
    estimated_value: 0,
    score: 50,
  };

  // Map CSV columns to lead fields using the mapping
  for (const [csvColumn, leadField] of Object.entries(mapping)) {
    // Only map to valid lead fields
    if (!VALID_LEAD_FIELDS.includes(leadField as (typeof VALID_LEAD_FIELDS)[number])) {
      continue;
    }

    const columnIndex = headers.indexOf(csvColumn);
    if (columnIndex === -1 || columnIndex >= row.length) continue;

    const value = row[columnIndex]?.trim();
    if (!value) continue;

    // Type coercion for specific fields
    if (leadField === "estimated_value") {
      const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
      lead[leadField] = isNaN(num) ? 0 : num;
    } else if (leadField === "employees") {
      const num = parseInt(value.replace(/[^0-9]/g, ""), 10);
      lead[leadField] = isNaN(num) ? null : num;
    } else if ((ARRAY_FIELDS as readonly string[]).includes(leadField)) {
      lead[leadField] = value.split(",").map((s: string) => s.trim()).filter(Boolean);
    } else {
      lead[leadField] = value;
    }
  }

  // Validate: at minimum a lead needs a name or email
  if (!lead.name && !lead.email) {
    return { error: "Missing both name and email, skipped" };
  }

  return { lead: lead as unknown as LeadInsert };
}
