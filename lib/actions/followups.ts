"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getUpcomingFollowups(days: number = 7) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  const { data, error } = await supabase
    .from("leads")
    .select("id, name, company, email, status, score, next_followup, followup_note")
    .eq("organization_id", orgId)
    .not("next_followup", "is", null)
    .gte("next_followup", now.toISOString())
    .lte("next_followup", future.toISOString())
    .order("next_followup", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getOverdueFollowups() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const now = new Date();

  const { data, error } = await supabase
    .from("leads")
    .select("id, name, company, email, status, score, next_followup, followup_note")
    .eq("organization_id", orgId)
    .not("next_followup", "is", null)
    .lt("next_followup", now.toISOString())
    .order("next_followup", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function setFollowup(
  leadId: string,
  data: { next_followup: string; followup_note?: string },
) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("leads")
    .update({
      next_followup: data.next_followup,
      followup_note: data.followup_note ?? null,
    })
    .eq("id", leadId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/leads");
  return { success: true };
}

export async function clearFollowup(leadId: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("leads")
    .update({
      next_followup: null,
      followup_note: null,
    })
    .eq("id", leadId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/leads");
  return { success: true };
}
