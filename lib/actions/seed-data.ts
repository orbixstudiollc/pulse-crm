"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, requireRole } from "./helpers";
import { insertSeed } from "@/lib/seed/insert";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

// ── Seed Functions ──────────────────────────────────────────────────────────

export async function seedAllData(): Promise<{
  success: boolean;
  error?: string;
  counts?: Record<string, number>;
}> {
  const orgId = await getOrgId();
  const { inserted, errors } = await insertSeed(await createClient(), orgId);

  revalidatePath("/dashboard", "layout");

  if (errors.length > 0) {
    return { success: false, error: errors.join("; ") };
  }
  return { success: true, counts: { records: inserted } };
}

export async function clearAllSeedData(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  let orgId: string;
  try {
    ({ orgId } = await requireRole("admin", "owner"));
  } catch (err) {
    unstable_rethrow(err);
    return { success: false, error: err instanceof Error ? err.message : "Forbidden: admin role required" };
  }

  try {
    // Delete in correct order to respect foreign keys
    await supabase.from("sequence_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sequence_enrollments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sequence_steps").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sequences").delete().eq("organization_id", orgId);
    await supabase.from("proposals").delete().eq("organization_id", orgId);
    await supabase.from("lead_competitors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("battle_cards").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("competitors").delete().eq("organization_id", orgId);
    await supabase.from("objection_playbook").delete().eq("organization_id", orgId);
    await supabase.from("contacts").delete().eq("organization_id", orgId);
    await supabase.from("lead_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("lead_activities").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("lead_score_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("leads").delete().eq("organization_id", orgId);
    await supabase.from("deal_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("deal_activities").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("deals").delete().eq("organization_id", orgId);
    await supabase.from("customer_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customer_activities").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customer_custom_fields").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customers").delete().eq("organization_id", orgId);
    await supabase.from("activities").delete().eq("organization_id", orgId);
    await supabase.from("calendar_events").delete().eq("organization_id", orgId);
    await supabase.from("email_templates").delete().eq("organization_id", orgId);
    await supabase.from("copy_templates").delete().eq("organization_id", orgId);
    await supabase.from("icp_profiles").delete().eq("organization_id", orgId);
    await supabase.from("scoring_profiles").delete().eq("organization_id", orgId);

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
