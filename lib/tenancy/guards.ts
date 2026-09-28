import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const CHUNK_SIZE = 500;

/**
 * True only when every id in `ids` is a row of `table` owned by `orgId`.
 * Empty list -> true. Any query error -> false.
 */
export async function allIdsBelongToOrg(
  supabase: SupabaseClient<Database>,
  table: "leads" | "email_accounts" | "sequences",
  orgId: string,
  ids: string[],
): Promise<boolean> {
  const requested = [...new Set(ids)];
  if (requested.length === 0) return true;

  const found = new Set<string>();
  for (let i = 0; i < requested.length; i += CHUNK_SIZE) {
    const chunk = requested.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("organization_id", orgId)
      .in("id", chunk);
    if (error || !data) return false;
    for (const row of data as { id: string }[]) found.add(row.id);
  }

  return found.size === requested.length;
}
