import type { SupabaseClient } from "@supabase/supabase-js";
import type { WritePatch, WriteTable } from "@/lib/mcp/tools-write";

/** Tables an update tool can target; each has organization_id and updated_at. */
const UPDATABLE: ReadonlySet<WriteTable> = new Set([
  "leads",
  "deals",
  "customers",
  "contacts",
  "activities",
  "calendar_events",
]);

/**
 * The current row for the columns a write will patch, plus id and updated_at (the
 * stale-write baseline), scoped to the org. Null for inserts, or when the row is not in
 * this org. Column names come from the tool's zod-parsed patch, never from free text.
 */
export async function fetchCurrentRecord(
  env: { db: SupabaseClient; ctx: { orgId: string } },
  target: WritePatch,
): Promise<Record<string, unknown> | null> {
  if (!target.id || !UPDATABLE.has(target.table)) return null;
  const columns = Array.from(new Set(["id", "updated_at", ...Object.keys(target.patch)])).join(", ");
  const { data, error } = await env.db
    .from(target.table)
    .select(columns)
    .eq("organization_id", env.ctx.orgId)
    .eq("id", target.id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as Record<string, unknown>;
}
