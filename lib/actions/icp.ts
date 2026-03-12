"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database, Json } from "@/types/database";

type ICPInsert = Database["public"]["Tables"]["icp_profiles"]["Insert"];
type ICPUpdate = Database["public"]["Tables"]["icp_profiles"]["Update"];

// ── Types ────────────────────────────────────────────────────────────────────

export type ICPCriteria = {
  firmographic: {
    industries: string[];
    company_sizes: string[];
    employee_range: { min: number | null; max: number | null };
    geography: string[];
  };
  technographic: {
    tech_stack: string[];
    tech_sophistication_min: number;
  };
  behavioral: {
    buying_patterns: string[];
    trigger_events: string[];
  };
  pain_points: Array<{ name: string; severity: number }>;
  budget: {
    revenue_range: { min: number | null; max: number | null };
    deal_size_sweet_spot: number | null;
    funding_stages: string[];
  };
  channel: {
    preferred_contact_methods: string[];
    content_preferences: string[];
  };
};

export type ICPWeights = {
  industry: number;
  size: number;
  revenue: number;
  title: number;
  geography: number;
  tech: number;
};

export type BuyerPersona = {
  role: string;
  goals: string[];
  challenges: string[];
  decision_criteria: string[];
};

export type ICPMatchBreakdown = {
  industry_score: number;
  size_score: number;
  revenue_score: number;
  geography_score: number;
  tech_score: number;
  total: number;
  grade: string;
  icp_name: string;
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getICPProfiles() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("icp_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getICPProfileById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("icp_profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function createICPProfile(profileData: {
  name: string;
  description?: string;
  criteria?: ICPCriteria;
  weights?: ICPWeights;
  buyer_personas?: BuyerPersona[];
  color?: string;
  is_primary?: boolean;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("icp_profiles")
    .insert({
      organization_id: orgId,
      name: profileData.name,
      description: profileData.description ?? null,
      criteria: (profileData.criteria ?? {}) as unknown as Json,
      weights: (profileData.weights ?? {}) as unknown as Json,
      buyer_personas: (profileData.buyer_personas ?? []) as unknown as Json,
      color: profileData.color ?? "#6366f1",
      is_primary: profileData.is_primary ?? false,
    } as ICPInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/icp");
  return { data };
}

export async function updateICPProfile(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    criteria: ICPCriteria;
    weights: ICPWeights;
    buyer_personas: BuyerPersona[];
    color: string;
    is_primary: boolean;
  }>,
) {
  const supabase = await createClient();
  await getOrgId();

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.criteria !== undefined) updateData.criteria = updates.criteria;
  if (updates.weights !== undefined) updateData.weights = updates.weights;
  if (updates.buyer_personas !== undefined) updateData.buyer_personas = updates.buyer_personas;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.is_primary !== undefined) updateData.is_primary = updates.is_primary;

  const { data, error } = await supabase
    .from("icp_profiles")
    .update(updateData as ICPUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/icp");
  revalidatePath(`/dashboard/icp/${id}`);
  return { data };
}

export async function deleteICPProfile(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("icp_profiles").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/icp");
  return { success: true };
}

// ── ICP Matching Algorithm ───────────────────────────────────────────────────

function matchIndustry(
  leadIndustry: string | null,
  targetIndustries: string[],
): number {
  if (!leadIndustry || targetIndustries.length === 0) return 50;
  const li = leadIndustry.toLowerCase();
  for (const t of targetIndustries) {
    if (li === t.toLowerCase()) return 100;
    if (li.includes(t.toLowerCase()) || t.toLowerCase().includes(li)) return 70;
  }
  return 10;
}

function matchSize(
  employees: string | null,
  targetSizes: string[],
): number {
  if (!employees || targetSizes.length === 0) return 50;

  const sizeMap: Record<string, number> = {
    "1-10": 1, "11-50": 2, "51-200": 3, "201-500": 4,
    "501-1000": 5, "1001-5000": 6, "5000+": 7,
  };

  const leadRank = sizeMap[employees] ?? 3;
  const targetRanks = targetSizes.map((s) => sizeMap[s] ?? 3);
  const minDist = Math.min(...targetRanks.map((t) => Math.abs(t - leadRank)));

  if (minDist === 0) return 100;
  if (minDist === 1) return 70;
  if (minDist === 2) return 40;
  return 10;
}

function matchRevenue(
  estimatedValue: number,
  revenueRange: { min: number | null; max: number | null },
  sweetSpot: number | null,
): number {
  if (!revenueRange.min && !revenueRange.max && !sweetSpot) return 50;

  if (sweetSpot) {
    const ratio = estimatedValue / sweetSpot;
    if (ratio >= 0.8 && ratio <= 1.2) return 100;
    if (ratio >= 0.5 && ratio <= 1.5) return 70;
    if (ratio >= 0.3 && ratio <= 2.0) return 40;
    return 10;
  }

  const min = revenueRange.min ?? 0;
  const max = revenueRange.max ?? Infinity;
  if (estimatedValue >= min && estimatedValue <= max) return 100;
  if (estimatedValue >= min * 0.5 && estimatedValue <= max * 1.5) return 60;
  return 20;
}

function matchGeography(
  location: string | null,
  targetGeos: string[],
): number {
  if (!location || targetGeos.length === 0) return 50;
  const loc = location.toLowerCase();
  for (const geo of targetGeos) {
    if (loc.includes(geo.toLowerCase()) || geo.toLowerCase().includes(loc)) return 100;
  }
  return 10;
}

function getGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

export async function calculateICPMatch(leadId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) return { error: leadError?.message || "Lead not found" };

  // Get all ICP profiles
  const { data: profiles, error: profError } = await supabase
    .from("icp_profiles")
    .select("*")
    .eq("organization_id", orgId);

  if (profError || !profiles || profiles.length === 0) {
    return { error: "No ICP profiles found" };
  }

  let bestScore = 0;
  let bestBreakdown: ICPMatchBreakdown | null = null;
  let bestProfileId: string | null = null;

  for (const profile of profiles) {
    const criteria = profile.criteria as unknown as ICPCriteria;
    const weights = profile.weights as unknown as ICPWeights;

    const industryScore = matchIndustry(
      lead.industry,
      criteria.firmographic?.industries ?? [],
    );
    const sizeScore = matchSize(
      lead.employees,
      criteria.firmographic?.company_sizes ?? [],
    );
    const revenueScore = matchRevenue(
      lead.estimated_value,
      criteria.budget?.revenue_range ?? { min: null, max: null },
      criteria.budget?.deal_size_sweet_spot ?? null,
    );
    const geoScore = matchGeography(
      lead.location,
      criteria.firmographic?.geography ?? [],
    );
    // Tech score — neutral if no data
    const techScore = 50;

    const totalWeight =
      (weights.industry ?? 25) +
      (weights.size ?? 20) +
      (weights.revenue ?? 15) +
      (weights.geography ?? 15) +
      (weights.tech ?? 10);

    const total = Math.round(
      (industryScore * (weights.industry ?? 25) +
        sizeScore * (weights.size ?? 20) +
        revenueScore * (weights.revenue ?? 15) +
        geoScore * (weights.geography ?? 15) +
        techScore * (weights.tech ?? 10)) /
        totalWeight,
    );

    if (total > bestScore) {
      bestScore = total;
      bestProfileId = profile.id;
      bestBreakdown = {
        industry_score: industryScore,
        size_score: sizeScore,
        revenue_score: revenueScore,
        geography_score: geoScore,
        tech_score: techScore,
        total,
        grade: getGrade(total),
        icp_name: profile.name,
      };
    }
  }

  // Update lead with best ICP match
  if (bestBreakdown && bestProfileId) {
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        icp_match_score: bestScore,
        icp_profile_id: bestProfileId,
        icp_match_breakdown: bestBreakdown as unknown as Json,
      })
      .eq("id", leadId);

    if (updateError) return { error: updateError.message };
  }

  // Fire automation rules for ICP grading
  if (bestScore != null) {
    const grade = bestScore >= 90 ? "A+" : bestScore >= 75 ? "A" : bestScore >= 60 ? "B" : bestScore >= 40 ? "C" : "D";
    import("@/lib/actions/automation").then(({ evaluateLeadAgainstRules }) =>
      evaluateLeadAgainstRules(leadId, "icp_graded", { grade }).catch(() => {}),
    );
  }

  return { data: bestBreakdown };
}

export async function recalculateICPMatches() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id")
    .eq("organization_id", orgId);

  if (error || !leads) return { error: error?.message || "No leads found" };

  const results = await Promise.all(
    leads.map((lead) => calculateICPMatch(lead.id)),
  );

  const errors = results.filter((r) => r.error);

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/icp");
  return {
    total: leads.length,
    matched: leads.length - errors.length,
    errors: errors.length,
  };
}

// ── ICP Insights ─────────────────────────────────────────────────────────────

export async function getICPInsights() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get leads with ICP data
  const { data: leads } = await supabase
    .from("leads")
    .select("icp_match_score, icp_profile_id, status")
    .eq("organization_id", orgId);

  // Get ICP profiles
  const { data: profiles } = await supabase
    .from("icp_profiles")
    .select("id, name, color")
    .eq("organization_id", orgId);

  if (!leads || !profiles) return { data: null };

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // Distribution by ICP
  const distribution: Record<string, { count: number; name: string; color: string; avgScore: number }> = {};
  let unmatched = 0;

  for (const lead of leads) {
    if (lead.icp_profile_id && profileMap.has(lead.icp_profile_id)) {
      const profile = profileMap.get(lead.icp_profile_id)!;
      if (!distribution[lead.icp_profile_id]) {
        distribution[lead.icp_profile_id] = {
          count: 0,
          name: profile.name,
          color: profile.color ?? "#6366f1",
          avgScore: 0,
        };
      }
      distribution[lead.icp_profile_id].count++;
      distribution[lead.icp_profile_id].avgScore += lead.icp_match_score ?? 0;
    } else {
      unmatched++;
    }
  }

  // Calculate averages
  for (const key of Object.keys(distribution)) {
    if (distribution[key].count > 0) {
      distribution[key].avgScore = Math.round(
        distribution[key].avgScore / distribution[key].count,
      );
    }
  }

  return {
    data: {
      totalLeads: leads.length,
      matchedLeads: leads.length - unmatched,
      unmatchedLeads: unmatched,
      distribution: Object.values(distribution),
      avgMatchScore:
        leads.length > 0
          ? Math.round(
              leads.reduce((sum, l) => sum + (l.icp_match_score ?? 0), 0) /
                leads.length,
            )
          : 0,
    },
  };
}

export async function getLeadsByICPProfile(icpProfileId: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("icp_profile_id", icpProfileId)
    .order("icp_match_score", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}
