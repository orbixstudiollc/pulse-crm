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
