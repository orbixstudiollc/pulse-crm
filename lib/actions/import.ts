"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { z } from "zod";
import {
  GUEST_MAX_LEADS,
  IMPORT_BATCH_ROWS,
  IMPORT_MAX_CELL_CHARS,
  IMPORT_MAX_HEADERS,
  VALID_LEAD_FIELDS,
  mapRowToLead,
  type LeadInsert,
} from "@/lib/import/lead-rows";

// ── CSV Parsing Helpers ──────────────────────────────────────────────────────

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
        const mapped = mapRowToLead(headers, row, fieldMapping, orgId);
        if ("error" in mapped) {
          errors.push(`Row ${rowNumber}: ${mapped.error}`);
          continue;
        }

        validLeads.push(mapped.lead);
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

      return { data: { imported: importedCount, importedIds, errors } };
    }

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

// ── Import Lead Rows (streamed batches) ─────────────────────────────────────

const cellSchema = z.string().max(IMPORT_MAX_CELL_CHARS);
const importLeadRowsSchema = z.object({
  headers: z.array(cellSchema).max(IMPORT_MAX_HEADERS),
  rows: z.array(z.array(cellSchema).max(IMPORT_MAX_HEADERS)).max(IMPORT_BATCH_ROWS),
  mapping: z
    .record(cellSchema, z.enum([...VALID_LEAD_FIELDS, "__skip__"]))
    .refine((m) => Object.keys(m).length <= IMPORT_MAX_HEADERS, "Too many mapped columns"),
  firstRowNumber: z.number().int().positive(),
});

type ImportLeadRowsResult =
  | { imported: number; importedIds: string[]; errors: string[]; guestLimitReached?: boolean }
  | { error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;
type NumberedLead = { lead: LeadInsert; rowNumber: number };

/** How many more leads a guest workspace can take; null when the user is not a guest. */
async function guestRoom(supabase: Supabase, orgId: string): Promise<number | { error: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.is_anonymous !== true) return null;

  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (error) return { error: `Import failed: ${error.message}` };
  return Math.max(0, GUEST_MAX_LEADS - (count ?? 0));
}

/** One insert for the batch; on failure, row by row with the real CSV row numbers. */
async function insertLeads(
  supabase: Supabase,
  leads: NumberedLead[],
  errors: string[],
): Promise<string[]> {
  if (leads.length === 0) return [];

  const { data: inserted, error: insertError } = await supabase
    .from("leads")
    .insert(leads.map((l) => l.lead))
    .select("id");
  if (!insertError) return (inserted ?? []).map((r) => r.id);

  const ids: string[] = [];
  for (const { lead, rowNumber } of leads) {
    const { data: single, error: singleError } = await supabase
      .from("leads")
      .insert(lead)
      .select("id")
      .single();
    if (singleError) errors.push(`Row ${rowNumber}: ${singleError.message}`);
    else if (single) ids.push(single.id);
  }
  return ids;
}

export async function importLeadRows(input: {
  headers: string[];
  rows: string[][];
  mapping: Record<string, string>;
  firstRowNumber: number;
}): Promise<ImportLeadRowsResult> {
  const parsed = importLeadRowsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: `Invalid import batch: ${parsed.error.issues[0]?.message ?? "bad input"}` };
  }
  const { headers, rows, mapping, firstRowNumber } = parsed.data;

  const supabase = await createClient();
  const orgId = await getOrgId();

  try {
    const errors: string[] = [];
    let leads: NumberedLead[] = [];
    rows.forEach((row, index) => {
      const rowNumber = firstRowNumber + index;
      const mapped = mapRowToLead(headers, row, mapping, orgId);
      if ("error" in mapped) errors.push(`Row ${rowNumber}: ${mapped.error}`);
      else leads.push({ lead: mapped.lead, rowNumber });
    });

    let guestLimitReached = false;
    if (leads.length > 0) {
      const room = await guestRoom(supabase, orgId);
      if (room !== null && typeof room === "object") return room;
      if (room !== null && leads.length > room) {
        leads = leads.slice(0, room);
        guestLimitReached = true;
      }
    }

    const importedIds = await insertLeads(supabase, leads, errors);
    return {
      imported: importedIds.length,
      importedIds,
      errors,
      ...(guestLimitReached ? { guestLimitReached: true } : {}),
    };
  } catch (err) {
    return { error: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}
