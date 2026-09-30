"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { escapePostgrestLike } from "@/lib/security";

export type RecordKind = "lead" | "customer" | "deal";

export type RecordResult = {
  id: string;
  kind: RecordKind;
  label: string;
  sublabel?: string;
};

/**
 * Typeahead search over the caller's org records. An empty query returns the
 * most recently created records of each requested kind.
 */
export async function searchRecords(
  query: string,
  kinds: RecordKind[] = ["lead", "customer", "deal"],
  requestedLimit = 8,
): Promise<RecordResult[]> {
  const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 1, 1), 25);
  const supabase = await createClient();
  const orgId = await getOrgId();
  const q = escapePostgrestLike(query.trim());

  const searches = kinds.map(async (kind): Promise<RecordResult[]> => {
    if (kind === "lead") {
      let req = supabase
        .from("leads")
        .select("id, name, email, company")
        .eq("organization_id", orgId);
      if (q) req = req.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`);
      const { data } = await req.order("created_at", { ascending: false }).limit(limit);
      return (data ?? []).map((r) => ({
        id: r.id,
        kind,
        label: r.name,
        sublabel: r.company || r.email || undefined,
      }));
    }

    if (kind === "customer") {
      let req = supabase
        .from("customers")
        .select("id, first_name, last_name, email, company")
        .eq("organization_id", orgId);
      if (q) {
        req = req.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`,
        );
      }
      const { data } = await req.order("created_at", { ascending: false }).limit(limit);
      return (data ?? []).map((r) => ({
        id: r.id,
        kind,
        label: `${r.first_name} ${r.last_name}`.trim() || r.email,
        sublabel: r.company || r.email || undefined,
      }));
    }

    let req = supabase
      .from("deals")
      .select("id, name, company")
      .eq("organization_id", orgId);
    if (q) req = req.or(`name.ilike.%${q}%,company.ilike.%${q}%`);
    const { data } = await req.order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r) => ({
      id: r.id,
      kind,
      label: r.name,
      sublabel: r.company || undefined,
    }));
  });

  // Interleave kinds so one kind cannot crowd the others out of the limit.
  const results = await Promise.all(searches);
  const merged: RecordResult[] = [];
  for (let i = 0; merged.length < limit && results.some((r) => i < r.length); i++) {
    for (const r of results) if (i < r.length && merged.length < limit) merged.push(r[i]);
  }
  return merged;
}
