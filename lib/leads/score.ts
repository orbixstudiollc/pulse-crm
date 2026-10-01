import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

/**
 * Lead scoring, shared by the Leads page (lib/actions/scoring.ts, cookie
 * client) and the MCP tools (lib/mcp, service-role client). Every query is
 * filtered by orgId, so it is safe with a client that bypasses RLS.
 */

type Db = SupabaseClient<Database>;
type ScoringProfile = Database["public"]["Tables"]["scoring_profiles"]["Row"];

export type ScoreBreakdown = {
  company_size_score: number;
  industry_fit_score: number;
  engagement_score: number;
  source_quality_score: number;
  budget_score: number;
  total: number;
  weights: {
    company_size: number;
    industry_fit: number;
    engagement: number;
    source_quality: number;
    budget: number;
  };
};

/** The org's default scoring profile, created with default weights if missing. */
export async function defaultScoringProfile(supabase: Db, orgId: string): Promise<ScoringProfile | null> {
  const { data } = await supabase
    .from("scoring_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .maybeSingle();
  if (data) return data;

  const { data: created } = await supabase
    .from("scoring_profiles")
    .insert({ organization_id: orgId, name: "Default", is_default: true })
    .select()
    .single();
  return created ?? null;
}

// ── Score Calculation ────────────────────────────────────────────────────────

function calcCompanySizeScore(
  employees: string | null,
  targetSizes: string[],
): number {
  if (!employees || targetSizes.length === 0) return 50; // neutral if no data

  const sizeMap: Record<string, number> = {
    "1-10": 1,
    "11-50": 2,
    "51-200": 3,
    "201-500": 4,
    "501-1000": 5,
    "1001-5000": 6,
    "5000+": 7,
  };

  const leadRank = sizeMap[employees] ?? 3;
  const targetRanks = targetSizes.map((s) => sizeMap[s] ?? 3);

  // Exact match = 100, adjacent = 60, far = 20
  const minDist = Math.min(...targetRanks.map((t) => Math.abs(t - leadRank)));
  if (minDist === 0) return 100;
  if (minDist === 1) return 60;
  if (minDist === 2) return 40;
  return 20;
}

function calcIndustryFitScore(
  industry: string | null,
  targetIndustries: string[],
): number {
  if (!industry || targetIndustries.length === 0) return 50;

  const leadIndustry = industry.toLowerCase();
  for (const target of targetIndustries) {
    if (leadIndustry === target.toLowerCase()) return 100;
    if (
      leadIndustry.includes(target.toLowerCase()) ||
      target.toLowerCase().includes(leadIndustry)
    )
      return 70;
  }
  return 10;
}

function calcEngagementScore(
  activityCount: number,
  notesCount: number,
  daysSinceCreation: number,
): number {
  const activityPoints = activityCount * 10;
  const notePoints = notesCount * 5;
  const recencyRatio =
    daysSinceCreation > 0
      ? Math.min(1, (activityCount + notesCount) / daysSinceCreation)
      : 1;
  const recencyPoints = recencyRatio * 20;

  return Math.min(100, Math.round(activityPoints + notePoints + recencyPoints));
}

function calcSourceQualityScore(
  source: string,
  rankings: Record<string, number>,
): number {
  return rankings[source] ?? 50;
}

function calcBudgetScore(estimatedValue: number): number {
  if (estimatedValue >= 100000) return 100;
  if (estimatedValue >= 50000) return 80;
  if (estimatedValue >= 20000) return 60;
  if (estimatedValue >= 5000) return 40;
  return 20;
}

export async function scoreLead(supabase: Db, orgId: string, leadId: string) {

  // Get lead data
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", leadId)
    .maybeSingle();

  if (leadError || !lead) return { error: leadError?.message || "Lead not found" };

  // Get scoring profile
  const profile = await defaultScoringProfile(supabase, orgId);
  if (!profile) return { error: "No scoring profile found" };

  // Get activity & note counts
  const [activitiesRes, notesRes] = await Promise.all([
    supabase
      .from("lead_activities")
      .select("id", { count: "exact" })
      .eq("lead_id", leadId),
    supabase
      .from("lead_notes")
      .select("id", { count: "exact" })
      .eq("lead_id", leadId),
  ]);

  const activityCount = activitiesRes.count ?? 0;
  const notesCount = notesRes.count ?? 0;
  const daysSinceCreation = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  // Calculate individual scores
  const companySizeScore = calcCompanySizeScore(
    lead.employees,
    profile.target_company_sizes,
  );
  const industryFitScore = calcIndustryFitScore(
    lead.industry,
    profile.target_industries,
  );
  const engagementScore = calcEngagementScore(
    activityCount,
    notesCount,
    daysSinceCreation,
  );
  const sourceQualityScore = calcSourceQualityScore(
    lead.source,
    (profile.source_rankings as Record<string, number>) ?? {},
  );
  const budgetScore = calcBudgetScore(lead.estimated_value);

  // Weighted composite
  const weights = {
    company_size: profile.weight_company_size,
    industry_fit: profile.weight_industry_fit,
    engagement: profile.weight_engagement,
    source_quality: profile.weight_source_quality,
    budget: profile.weight_budget,
  };

  const totalWeight =
    weights.company_size +
    weights.industry_fit +
    weights.engagement +
    weights.source_quality +
    weights.budget;

  const total = Math.round(
    (companySizeScore * weights.company_size +
      industryFitScore * weights.industry_fit +
      engagementScore * weights.engagement +
      sourceQualityScore * weights.source_quality +
      budgetScore * weights.budget) /
      totalWeight,
  );

  const breakdown: ScoreBreakdown = {
    company_size_score: companySizeScore,
    industry_fit_score: industryFitScore,
    engagement_score: engagementScore,
    source_quality_score: sourceQualityScore,
    budget_score: budgetScore,
    total,
    weights,
  };

  // Update lead with score
  const { error: updateError } = await supabase
    .from("leads")
    .update({
      score: total,
      score_breakdown: breakdown as unknown as Json,
      engagement_score: engagementScore,
      last_scored_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId)
    .eq("id", leadId);

  if (updateError) return { error: updateError.message };

  // Record in history
  await supabase.from("lead_score_history").insert({
    lead_id: leadId,
    score: total,
    breakdown: breakdown as unknown as Json,
  });

  // Fire automation rules for score change
  import("@/lib/automation/runner").then(({ evaluateLeadAgainstRules }) =>
    evaluateLeadAgainstRules(leadId, "score_changed", {
      old_score: lead.score,
      new_score: total,
    }).catch(() => {}),
  );

  return { data: breakdown };
}
