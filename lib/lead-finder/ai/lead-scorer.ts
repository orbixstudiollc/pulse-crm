import "server-only";

import { createClient } from "@/lib/supabase/server";
import { generateCompletion, logLlmCost } from "../ai-provider";
import type { AIProvider, LFLead, KpiDefinition } from "../types";

// =============================================================================
// Lead Scorer – AI-powered scoring based on enrichment data & KPIs
// =============================================================================

export interface ScoreResult {
  score: number;
  reasoning: string;
  breakdown: Record<string, number>;
}

/**
 * Score a single lead using AI analysis of its data, personalization,
 * and campaign KPI definitions.
 */
export async function scoreLead(
  leadId: string,
  orgId: string,
  options?: {
    aiProvider?: AIProvider;
    campaignId?: string;
    kpiDefinitions?: KpiDefinition[];
    targetNiche?: string;
  }
): Promise<ScoreResult> {
  const supabase = await createClient();
  const aiProvider = options?.aiProvider ?? "anthropic";
  const campaignId = options?.campaignId;

  // Load lead
  const { data: lead } = await supabase
    .from("lf_leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .single();

  if (!lead) throw new Error("Lead not found");
  const typedLead = lead as unknown as LFLead;

  // Load personalization data if available
  const { data: personalization } = await supabase
    .from("lf_lead_personalization")
    .select("*")
    .eq("lead_id", leadId)
    .single();

  // Build scoring prompt
  const kpiSection =
    options?.kpiDefinitions && options.kpiDefinitions.length > 0
      ? `\nCampaign KPIs to consider:\n${options.kpiDefinitions
          .map((k) => `- ${k.label}: ${k.description ?? ""}`)
          .join("\n")}`
      : "";

  const personalizationSection = personalization
    ? `\nEnrichment data:
- Tech stack: ${(personalization.website_tech_stack as string[])?.join(", ") || "Unknown"}
- Website quality: ${personalization.website_quality_score ?? "N/A"}/100
- Has chatbot: ${personalization.has_chatbot}
- Has booking system: ${personalization.has_booking_system}
- Has automation: ${personalization.has_automation}
- Pain points: ${(personalization.pain_points as string[])?.join(", ") || "None identified"}
- Company description: ${personalization.company_description ?? "N/A"}
- KPI evaluations: ${JSON.stringify(personalization.campaign_kpis ?? {})}`
    : "";

  const prompt = `Score this lead on a scale of 0-100 based on their potential as a sales prospect.
${options?.targetNiche ? `\nTarget niche: ${options.targetNiche}` : ""}

Lead details:
- Name: ${typedLead.display_name ?? "Unknown"}
- Email: ${typedLead.email ?? "N/A"}
- Phone: ${typedLead.phone ?? "N/A"}
- Website: ${typedLead.website ?? "N/A"}
- Source: ${typedLead.source}
${personalizationSection}
${kpiSection}

Respond in JSON:
{
  "score": 0-100,
  "reasoning": "2-3 sentence explanation",
  "breakdown": {
    "data_completeness": 0-100,
    "business_fit": 0-100,
    "engagement_potential": 0-100,
    "technology_readiness": 0-100
  }
}`;

  const response = await generateCompletion(
    [
      {
        role: "system",
        content:
          "You are a lead scoring expert. Always respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    aiProvider,
    orgId,
    { temperature: 0.3, maxTokens: 512 }
  );

  await logLlmCost(response, "lead-scoring", orgId, campaignId);

  // Update lead LLM costs
  await supabase
    .from("lf_leads")
    .update({
      llm_cost_usd: (typedLead.llm_cost_usd || 0) + response.costUsd,
      llm_input_tokens:
        (typedLead.llm_input_tokens || 0) + response.inputTokens,
      llm_output_tokens:
        (typedLead.llm_output_tokens || 0) + response.outputTokens,
    })
    .eq("id", leadId)
    .eq("organization_id", orgId);

  // Parse
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as ScoreResult;

    const score =
      typeof parsed.score === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.score)))
        : 50;

    // Persist score
    await supabase
      .from("lf_leads")
      .update({ score })
      .eq("id", leadId)
      .eq("organization_id", orgId);

    return {
      score,
      reasoning: parsed.reasoning ?? "",
      breakdown: parsed.breakdown ?? {},
    };
  } catch {
    return { score: 50, reasoning: "Unable to parse AI scoring result", breakdown: {} };
  }
}

/**
 * Batch-score multiple leads for a campaign.
 */
export async function scoreCampaignLeads(
  campaignId: string,
  orgId: string,
  options?: { aiProvider?: AIProvider; limit?: number }
): Promise<{ scored: number; averageScore: number }> {
  const supabase = await createClient();
  const limit = options?.limit ?? 100;

  // Load campaign for context
  const { data: campaign } = await supabase
    .from("lf_campaigns")
    .select("target_niche, kpi_definitions, ai_provider")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .single();

  // Get leads that need scoring (score = 0)
  const { data: leads } = await supabase
    .from("lf_leads")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("organization_id", orgId)
    .eq("score", 0)
    .limit(limit);

  if (!leads || leads.length === 0) {
    return { scored: 0, averageScore: 0 };
  }

  let totalScore = 0;
  let scored = 0;

  for (const lead of leads) {
    try {
      const result = await scoreLead(lead.id, orgId, {
        aiProvider:
          (options?.aiProvider ??
            campaign?.ai_provider) as AIProvider | undefined,
        campaignId,
        kpiDefinitions: campaign?.kpi_definitions as KpiDefinition[] | undefined,
        targetNiche: campaign?.target_niche,
      });
      totalScore += result.score;
      scored++;
    } catch {
      // Non-fatal, continue with next lead
    }
  }

  return {
    scored,
    averageScore: scored > 0 ? Math.round(totalScore / scored) : 0,
  };
}
