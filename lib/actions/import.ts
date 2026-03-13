"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

// ── CSV Parsing Helpers ──────────────────────────────────────────────────────

const VALID_LEAD_FIELDS = [
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
const ARRAY_FIELDS = ["tags", "content_interests"] as const;

function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  // Push the last field
  fields.push(current.trim());

  return fields;
}

function parseCSVContent(csvContent: string): { headers: string[]; rows: string[][] } {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCSVRow(lines[0]);
  const rows = lines.slice(1).map((line) => parseCSVRow(line));

  return { headers, rows };
}

// ── Parse CSV Preview ────────────────────────────────────────────────────────

export async function parseCSVPreview(csvContent: string) {
  try {
    const { headers, rows } = parseCSVContent(csvContent);

    if (headers.length === 0) {
      return { error: "CSV file is empty or has no headers" };
    }

    const preview = rows.slice(0, 5);
    const totalRows = rows.length;

    return {
      data: {
        headers,
        preview,
        totalRows,
      },
    };
  } catch (err) {
    return { error: `Failed to parse CSV: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

// ── Import Leads ─────────────────────────────────────────────────────────────

export async function importLeads(
  csvContent: string,
  fieldMapping: Record<string, string>,
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  try {
    const { headers, rows } = parseCSVContent(csvContent);

    if (headers.length === 0 || rows.length === 0) {
      return { error: "CSV file is empty or has no data rows" };
    }

    const errors: string[] = [];
    const validLeads: LeadInsert[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is headers, and we're 1-indexed

      try {
        const lead: Record<string, unknown> & { organization_id: string; name?: string; email?: string } = {
          organization_id: orgId,
          status: "cold",
          source: "Website",
          estimated_value: 0,
          score: 50,
        };

        // Map CSV columns to lead fields using the fieldMapping
        for (const [csvColumn, leadField] of Object.entries(fieldMapping)) {
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
          errors.push(`Row ${rowNumber}: Missing both name and email, skipped`);
          continue;
        }

        validLeads.push(lead as unknown as LeadInsert);
      } catch (rowErr) {
        errors.push(
          `Row ${rowNumber}: ${rowErr instanceof Error ? rowErr.message : "Unknown error"}`,
        );
      }
    }

    if (validLeads.length === 0) {
      return {
        error: "No valid leads found in CSV",
        data: { imported: 0, errors },
      };
    }

    // Insert all valid leads in a single batch
    const { data: inserted, error: insertError } = await supabase
      .from("leads")
      .insert(validLeads)
      .select("id");

    if (insertError) {
      // If batch insert fails, try inserting one by one to save valid rows
      let importedCount = 0;
      const importedIds: string[] = [];

      for (let i = 0; i < validLeads.length; i++) {
        const { data: singleInserted, error: singleError } = await supabase
          .from("leads")
          .insert(validLeads[i])
          .select("id")
          .single();

        if (singleError) {
          errors.push(
            `Row ${i + 2}: ${singleError.message}`,
          );
        } else {
          importedCount++;
          if (singleInserted) importedIds.push(singleInserted.id);
        }
      }

      revalidatePath("/dashboard/leads");
      return { data: { imported: importedCount, importedIds, errors } };
    }

    revalidatePath("/dashboard/leads");
    return {
      data: {
        imported: inserted?.length ?? validLeads.length,
        importedIds: inserted?.map((r) => r.id) ?? [],
        errors,
      },
    };
  } catch (err) {
    return {
      error: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
