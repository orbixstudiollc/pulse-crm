"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database, Json } from "@/types/database";

type CompetitorInsert = Database["public"]["Tables"]["competitors"]["Insert"];
type CompetitorUpdate = Database["public"]["Tables"]["competitors"]["Update"];
type BattleCardInsert = Database["public"]["Tables"]["battle_cards"]["Insert"];
type BattleCardUpdate = Database["public"]["Tables"]["battle_cards"]["Update"];

// ── Competitor CRUD ──────────────────────────────────────────────────────────

export async function getCompetitors() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getCompetitorById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function createCompetitor(competitorData: {
  name: string;
  website?: string;
  category?: string;
  description?: string;
  strengths?: string[];
  weaknesses?: string[];
  pricing?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("competitors")
    .insert({
      organization_id: orgId,
      name: competitorData.name,
      website: competitorData.website ?? null,
      category: competitorData.category ?? "direct",
      description: competitorData.description ?? null,
      strengths: competitorData.strengths ?? [],
      weaknesses: competitorData.weaknesses ?? [],
      pricing: (competitorData.pricing ?? {}) as Json,
    } as CompetitorInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/competitors");
  return { data };
}

export async function updateCompetitor(
  id: string,
  updates: Partial<{
    name: string;
    website: string | null;
    category: string;
    description: string | null;
    strengths: string[];
    weaknesses: string[];
    pricing: Record<string, unknown>;
  }>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("competitors")
    .update(updates as CompetitorUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/competitors");
  revalidatePath(`/dashboard/competitors/${id}`);
  return { data };
}

export async function deleteCompetitor(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("competitors").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/competitors");
  return { success: true };
}

// ── Battle Card CRUD ─────────────────────────────────────────────────────────

export async function getBattleCard(competitorId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("battle_cards")
    .select("*")
    .eq("competitor_id", competitorId)
    .single();

  if (error && error.code !== "PGRST116") return { error: error.message, data: null };
  return { data: data ?? null };
}

export async function upsertBattleCard(
  competitorId: string,
  cardData: {
    their_strengths?: string[];
    their_weaknesses?: string[];
    our_advantages?: string[];
    switching_costs?: Record<string, unknown>;
    switching_triggers?: string[];
    landmine_questions?: string[];
    positioning_statement?: string | null;
  },
) {
  const supabase = await createClient();

  // Check if battle card exists
  const { data: existing } = await supabase
    .from("battle_cards")
    .select("id")
    .eq("competitor_id", competitorId)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("battle_cards")
      .update({
        ...cardData,
        switching_costs: (cardData.switching_costs ?? {}) as Json,
      } as BattleCardUpdate)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath(`/dashboard/competitors/${competitorId}`);
    return { data };
  } else {
    const { data, error } = await supabase
      .from("battle_cards")
      .insert({
        competitor_id: competitorId,
        ...cardData,
        switching_costs: (cardData.switching_costs ?? {}) as Json,
      } as BattleCardInsert)
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath(`/dashboard/competitors/${competitorId}`);
    return { data };
  }
}

// ── Lead Competitors ─────────────────────────────────────────────────────────

export async function linkCompetitorToLead(
  leadId: string,
  competitorId: string,
  confidence: string = "medium",
  evidence?: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_competitors")
    .insert({
      lead_id: leadId,
      competitor_id: competitorId,
      confidence,
      evidence: evidence ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Competitor already linked to this lead" };
    return { error: error.message };
  }

  revalidatePath(`/dashboard/leads/${leadId}`);
  return { data };
}

export async function unlinkCompetitorFromLead(leadId: string, competitorId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("lead_competitors")
    .delete()
    .eq("lead_id", leadId)
    .eq("competitor_id", competitorId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/leads/${leadId}`);
  return { success: true };
}

export async function getLeadCompetitors(leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_competitors")
    .select("*")
    .eq("lead_id", leadId)
    .order("detected_at", { ascending: false }) as unknown as {
    data: Array<{
      id: string;
      lead_id: string;
      competitor_id: string;
      confidence: string;
      evidence: string | null;
      detected_at: string;
    }> | null;
    error: { message: string } | null;
  };

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getCompetitiveContext(leadId: string) {
  const supabase = await createClient();

  // Get linked competitors for this lead
  const { data: links } = await supabase
    .from("lead_competitors")
    .select("competitor_id, confidence, evidence")
    .eq("lead_id", leadId);

  if (!links || links.length === 0) return { data: [] };

  const competitorIds = links.map((l) => l.competitor_id);

  // Get competitor details + battle cards
  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .in("id", competitorIds);

  const { data: battleCards } = await supabase
    .from("battle_cards")
    .select("*")
    .in("competitor_id", competitorIds);

  const result = (competitors ?? []).map((comp) => ({
    ...comp,
    link: links.find((l) => l.competitor_id === comp.id),
    battleCard: (battleCards ?? []).find((bc) => bc.competitor_id === comp.id) || null,
  }));

  return { data: result };
}
