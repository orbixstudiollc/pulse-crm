"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import { scoreLead } from "@/lib/leads/score";
import type { Database } from "@/types/database";

type ScoringProfileInsert =
  Database["public"]["Tables"]["scoring_profiles"]["Insert"];
type ScoringProfileUpdate =
  Database["public"]["Tables"]["scoring_profiles"]["Update"];

// ── Scoring Profile CRUD ─────────────────────────────────────────────────────

export async function getScoringProfile() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("scoring_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .single();

  if (error && error.code === "PGRST116") {
    // No default profile exists — create one
    const { data: created, error: createError } = await supabase
      .from("scoring_profiles")
      .insert({
        organization_id: orgId,
        name: "Default",
        is_default: true,
      } as ScoringProfileInsert)
      .select()
      .single();

    if (createError) return { error: createError.message, data: null };
    return { data: created };
  }

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function upsertScoringProfile(
  updates: Partial<{
    name: string;
    weight_company_size: number;
    weight_industry_fit: number;
    weight_engagement: number;
    weight_source_quality: number;
    weight_budget: number;
    target_industries: string[];
    target_company_sizes: string[];
    source_rankings: Record<string, number>;
  }>,
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get or create default profile
  const existing = await getScoringProfile();
  const profileId = existing.data?.id;

  if (profileId) {
    const { data, error } = await supabase
      .from("scoring_profiles")
      .update(updates as ScoringProfileUpdate)
      .eq("id", profileId)
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings");
    return { data };
  }

  // Create new
  const { data, error } = await supabase
    .from("scoring_profiles")
    .insert({
      ...updates,
      organization_id: orgId,
      is_default: true,
    } as ScoringProfileInsert)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { data };
}

// ── Score Calculation ────────────────────────────────────────────────────────

export async function calculateLeadScore(leadId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  return scoreLead(supabase, orgId, leadId);
}

export async function recalculateAllScores() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id")
    .eq("organization_id", orgId);

  if (error || !leads) return { error: error?.message || "No leads found" };

  const results = await Promise.all(
    leads.map((lead) => calculateLeadScore(lead.id)),
  );

  const errors = results.filter((r) => r.error);

  revalidatePath("/dashboard/leads");
  return {
    total: leads.length,
    scored: leads.length - errors.length,
    errors: errors.length,
  };
}

// ── Score History ────────────────────────────────────────────────────────────

export async function getLeadScoreHistory(leadId: string, limit = 20) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_score_history")
    .select("*")
    .eq("lead_id", leadId)
    .order("scored_at", { ascending: false })
    .limit(limit);

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}
