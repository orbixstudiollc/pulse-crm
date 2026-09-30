"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";

// ── Read ─────────────────────────────────────────────────────────────────────

/** Members of the caller's organization; the caller is always listed first. */
export async function getOrgMembers(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { user } = await getCurrentUserProfile();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("organization_id", orgId);

  if (error) throw new Error(error.message);

  const members = (data ?? []).map((p) => ({
    id: p.id,
    name:
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      p.email.split("@")[0],
  }));

  return [
    ...members.filter((m) => m.id === user.id),
    ...members.filter((m) => m.id !== user.id),
  ];
}
