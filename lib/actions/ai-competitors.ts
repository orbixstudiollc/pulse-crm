"use server";

import { createClient } from "@/lib/supabase/server";
import { getAIClient, logTokenUsage } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { getModelId } from "@/lib/ai/models";
import { revalidatePath } from "next/cache";

/**
 * Parse a JSON response from the AI, handling markdown code block wrappers.
 */
function parseJSON<T>(text: string): T {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BattleCardResult {
  competitor_name: string;
  positioning: string;
  strengths_counter: Array<{ strength: string; counter: string }>;
  weaknesses_exploit: Array<{ weakness: string; approach: string }>;
  pricing_comparison: string;
  win_themes: string[];
  key_differentiators: string[];
  landmines: string[];
}

interface CompetitorAnalysis {
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  market_position: string;
  risk_level: string;
  recommendation: string;
}

// ─── aiGenerateBattleCard ────────────────────────────────────────────────────

/**
 * Generate a comprehensive battle card for a competitor.
 * Optionally includes lead-specific context for tailored positioning.
 */
export async function aiGenerateBattleCard(
  competitorId: string,
  leadId?: string
): Promise<BattleCardResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_competitors) {
      return { error: "AI competitors feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch competitor data
    const { data: competitor, error: compError } = await supabase
      .from("competitors")
      .select(
        "id, name, website, category, description, strengths, weaknesses, pricing, organization_id"
      )
      .eq("id", competitorId)
      .single();

    if (compError || !competitor) {
      return {
        error: `Competitor not found: ${compError?.message || "Unknown error"}`,
      };
    }

    // Fetch existing battle cards for this competitor
    const { data: battleCards } = await supabase
      .from("battle_cards")
      .select("id, their_strengths, their_weaknesses, our_advantages, switching_costs, switching_triggers, landmine_questions, positioning_statement")
      .eq("competitor_id", competitorId)
      .limit(10);

    // Optionally fetch lead data for context
    let lead: Record<string, unknown> | null = null;
    if (leadId) {
      const { data: leadData } = await supabase
        .from("leads")
        .select(
          "id, name, company, industry, employees, estimated_value, status, score, qualification_data"
        )
        .eq("id", leadId)
        .single();
      lead = leadData;
    }

    // Build the prompt
    const sections: string[] = [];

    sections.push(`## Competitor Profile
- Name: ${competitor.name}
- Website: ${competitor.website || "N/A"}
- Category: ${competitor.category || "N/A"}
- Description: ${competitor.description || "N/A"}
- Strengths: ${(competitor.strengths || []).join(", ") || "N/A"}
- Weaknesses: ${(competitor.weaknesses || []).join(", ") || "N/A"}
- Pricing: ${competitor.pricing ? JSON.stringify(competitor.pricing) : "N/A"}`);

    if (battleCards && battleCards.length > 0) {
      const cardLines = battleCards
        .map(
          (bc) =>
            `- Positioning: ${bc.positioning_statement || "N/A"} | Our Advantages: ${(bc.our_advantages || []).join(", ")} | Landmines: ${(bc.landmine_questions || []).join(", ")}`
        )
        .join("\n");
      sections.push(
        `## Existing Battle Cards (${battleCards.length})\n${cardLines}`
      );
    }

    if (lead) {
      sections.push(`## Lead Context (for tailored positioning)
- Name: ${lead.name || "N/A"}
- Company: ${lead.company || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Status: ${lead.status || "N/A"}
- Qualification: ${lead.qualification_data ? JSON.stringify(lead.qualification_data) : "N/A"}`);
    }

    sections.push(`
Please generate a comprehensive battle card. Return a JSON object with:
- competitor_name: string
- positioning: string (how to position against this competitor)
- strengths_counter: Array of { strength: string, counter: string } (counter each of their strengths)
- weaknesses_exploit: Array of { weakness: string, approach: string } (how to exploit each weakness)
- pricing_comparison: string (pricing strategy comparison and talking points)
- win_themes: string[] (3-5 key themes to emphasize when competing)
- key_differentiators: string[] (3-5 unique differentiators)
- landmines: string[] (3-5 trap questions to set for the competitor)

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: getModelId("sonnet", settings?.ai_provider),
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.competitive_analysis,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: BattleCardResult;
    try {
      parsed = parseJSON<BattleCardResult>(text);
    } catch {
      return { error: "Failed to parse AI battle card response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "competitors",
      model: getModelId("sonnet", settings?.ai_provider),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { competitorId, leadId, function: "aiGenerateBattleCard" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.message
        : "AI battle card generation failed";

    try {
      const { settings: errSettings, orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "competitors",
        model: getModelId("sonnet", errSettings?.ai_provider),
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { competitorId, leadId, function: "aiGenerateBattleCard" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ─── aiAnalyzeCompetitor ────────────────────────────────────────────────────

/**
 * Perform a SWOT analysis and market position assessment for a competitor.
 */
export async function aiAnalyzeCompetitor(
  competitorId: string
): Promise<CompetitorAnalysis | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_competitors) {
      return { error: "AI competitors feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch competitor data
    const { data: competitor, error: compError } = await supabase
      .from("competitors")
      .select(
        "id, name, website, category, description, strengths, weaknesses, pricing, organization_id"
      )
      .eq("id", competitorId)
      .single();

    if (compError || !competitor) {
      return {
        error: `Competitor not found: ${compError?.message || "Unknown error"}`,
      };
    }

    // Fetch existing battle cards for additional context
    const { data: battleCards } = await supabase
      .from("battle_cards")
      .select("id, their_strengths, their_weaknesses, our_advantages, switching_costs, switching_triggers, landmine_questions, positioning_statement")
      .eq("competitor_id", competitorId)
      .limit(10);

    const sections: string[] = [];

    sections.push(`## Competitor Profile
- Name: ${competitor.name}
- Website: ${competitor.website || "N/A"}
- Category: ${competitor.category || "N/A"}
- Description: ${competitor.description || "N/A"}
- Known Strengths: ${(competitor.strengths || []).join(", ") || "None listed"}
- Known Weaknesses: ${(competitor.weaknesses || []).join(", ") || "None listed"}
- Pricing Info: ${competitor.pricing ? JSON.stringify(competitor.pricing) : "N/A"}`);

    if (battleCards && battleCards.length > 0) {
      const cardLines = battleCards
        .map(
          (bc) =>
            `- Positioning: ${bc.positioning_statement || "N/A"} | Our Advantages: ${(bc.our_advantages || []).join(", ")} | Their Strengths: ${(bc.their_strengths || []).join(", ")} | Their Weaknesses: ${(bc.their_weaknesses || []).join(", ")}`
        )
        .join("\n");
      sections.push(
        `## Existing Intelligence (${battleCards.length})\n${cardLines}`
      );
    }

    sections.push(`
Please perform a comprehensive competitive analysis. Return a JSON object with:
- swot: { strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] }
- market_position: string (assessment of their market position and trajectory)
- risk_level: string ("low" | "medium" | "high" | "critical" - threat level to our business)
- recommendation: string (strategic recommendation for dealing with this competitor)

Base the SWOT on available data. For opportunities and threats, consider market dynamics and competitive positioning.
Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: getModelId("sonnet", settings?.ai_provider),
      max_tokens: 1536,
      system: SYSTEM_PROMPTS.competitive_analysis,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: CompetitorAnalysis;
    try {
      parsed = parseJSON<CompetitorAnalysis>(text);
    } catch {
      return { error: "Failed to parse AI competitor analysis response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "competitors",
      model: getModelId("sonnet", settings?.ai_provider),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { competitorId, function: "aiAnalyzeCompetitor" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.message
        : "AI competitor analysis failed";

    try {
      const { settings: errSettings, orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "competitors",
        model: getModelId("sonnet", errSettings?.ai_provider),
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { competitorId, function: "aiAnalyzeCompetitor" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}
