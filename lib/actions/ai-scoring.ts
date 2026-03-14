"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAIClient, callAIWithFallback } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { getModelId } from "@/lib/ai/models";
import { AIScoreResult } from "@/lib/ai/types";
import { revalidatePath } from "next/cache";

/**
 * Parse a JSON response from the AI, handling markdown code block wrappers.
 */
function parseAIJson<T>(text: string): T {
  // Try to extract from markdown code blocks first (```json ... ``` or ``` ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}

/**
 * AI-powered lead scoring for a single lead.
 * Fetches lead data, scoring profile, recent activities, notes, and score history,
 * then uses Claude Haiku to generate a comprehensive score.
 */
export async function aiScoreLead(
  leadId: string
): Promise<AIScoreResult | { error: string }> {
  try {
    // Get AI client and auth context
    const { settings, orgId, userId } = await getAIClient();

    // Check if lead scoring feature is enabled
    if (!settings.feature_lead_scoring) {
      return { error: "AI lead scoring is disabled in settings" };
    }

    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, name, email, phone, company, website, linkedin, source, status, score, estimated_value, industry, employees, win_probability, qualification_data, organization_id, created_at, updated_at"
      )
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { error: `Lead not found: ${leadError?.message || "Unknown error"}` };
    }

    // Fetch the default scoring profile for the organization
    const { data: scoringProfile } = await supabase
      .from("scoring_profiles")
      .select("id, name, weight_company_size, weight_industry_fit, weight_engagement, weight_source_quality, weight_budget, target_industries, target_company_sizes, source_rankings, is_default")
      .eq("organization_id", orgId)
      .eq("is_default", true)
      .single();

    // Fetch recent activities for this lead (limit 10)
    const { data: activities } = await supabase
      .from("activities")
      .select("id, type, description, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch recent notes for this lead (limit 5)
    const { data: notes } = await supabase
      .from("lead_notes")
      .select("id, content, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch recent score history (limit 3)
    const { data: scoreHistory } = await supabase
      .from("lead_score_history")
      .select("id, score, breakdown, scored_at")
      .eq("lead_id", leadId)
      .order("scored_at", { ascending: false })
      .limit(3);

    // Build detailed prompt with all lead data
    const prompt = buildScoringPrompt(
      lead,
      scoringProfile,
      activities || [],
      notes || [],
      scoreHistory || []
    );

    // Call AI with automatic provider fallback
    const aiResult = await callAIWithFallback({
      settings,
      createParams: (modelId) => ({
        model: modelId,
        max_tokens: 1024,
        system: SYSTEM_PROMPTS.lead_scoring,
        messages: [{ role: "user", content: prompt }],
      }),
      feature: "lead_scoring",
      orgId,
      userId,
      modelOverride: getModelId("haiku", settings?.ai_provider),
    });

    // Extract text from response
    const text = aiResult.response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse AI response
    let parsed: {
      score: number;
      dimensions: {
        fit: number;
        engagement: number;
        intent: number;
        timing: number;
        budget: number;
      };
      reasoning: string;
      recommendations: string[];
    };

    try {
      parsed = parseAIJson(text);
    } catch {
      return { error: "Failed to parse AI scoring response" };
    }

    // Validate the parsed result
    if (
      typeof parsed.score !== "number" ||
      parsed.score < 0 ||
      parsed.score > 100
    ) {
      return { error: "Invalid score returned from AI" };
    }

    // Clamp score to 0-100 range
    const finalScore = Math.round(Math.min(100, Math.max(0, parsed.score)));

    // Build the result conforming to AIScoreResult type
    const result: AIScoreResult = {
      score: finalScore,
      dimensions: {
        fit: Math.round(Math.min(100, Math.max(0, parsed.dimensions?.fit || 0))),
        engagement: Math.round(
          Math.min(100, Math.max(0, parsed.dimensions?.engagement || 0))
        ),
        intent: Math.round(
          Math.min(100, Math.max(0, parsed.dimensions?.intent || 0))
        ),
        timing: Math.round(
          Math.min(100, Math.max(0, parsed.dimensions?.timing || 0))
        ),
        budget: Math.round(
          Math.min(100, Math.max(0, parsed.dimensions?.budget || 0))
        ),
      },
      reasoning: parsed.reasoning || "",
      recommendations: parsed.recommendations || [],
    };

    // Update lead score (admin client bypasses RLS)
    const { error: updateError } = await adminSupabase
      .from("leads")
      .update({
        score: result.score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) {
      console.error("Failed to update lead score:", updateError);
    }

    // Insert score history record (admin client bypasses RLS)
    const { error: historyError } = await adminSupabase
      .from("lead_score_history")
      .insert({
        lead_id: leadId,
        score: result.score,
        breakdown: {
          ...result.dimensions,
          ai_scored: true,
          reasoning: result.reasoning,
          recommendations: result.recommendations,
        },
        scored_at: new Date().toISOString(),
        scoring_profile_id: scoringProfile?.id || null,
      });

    if (historyError) {
      console.error("Failed to insert score history:", historyError);
    }

    // Revalidate relevant pages
    revalidatePath("/dashboard/leads");
    revalidatePath(`/dashboard/leads/${leadId}`);

    return result;
  } catch (error) {
    console.error("[AI Scoring] Failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "AI scoring failed";
    return { error: errorMessage };
  }
}

/**
 * AI-powered lead scoring for multiple leads in batch.
 * Processes leads sequentially to avoid rate limiting.
 */
export async function aiScoreLeadsBatch(
  leadIds: string[]
): Promise<{
  results: Array<{ leadId: string; result: AIScoreResult | { error: string } }>;
}> {
  const results: Array<{
    leadId: string;
    result: AIScoreResult | { error: string };
  }> = [];

  // Process sequentially to avoid rate limiting
  for (const leadId of leadIds) {
    try {
      const result = await aiScoreLead(leadId);
      results.push({ leadId, result });
    } catch (error) {
      results.push({
        leadId,
        result: {
          error:
            error instanceof Error
              ? error.message
              : "Unexpected error during batch scoring",
        },
      });
    }
  }

  return { results };
}

/**
 * Build a comprehensive prompt with all lead context for scoring.
 */
function buildScoringPrompt(
  lead: Record<string, unknown>,
  scoringProfile: Record<string, unknown> | null,
  activities: Array<Record<string, unknown>>,
  notes: Array<Record<string, unknown>>,
  scoreHistory: Array<Record<string, unknown>>
): string {
  const sections: string[] = [];

  // Lead profile section
  sections.push(`## Lead Profile
- Name: ${lead.name || "N/A"}
- Email: ${lead.email || "N/A"}
- Phone: ${lead.phone || "N/A"}
- Company: ${lead.company || "N/A"}
- Website: ${lead.website || "N/A"}
- LinkedIn: ${lead.linkedin || "N/A"}
- Source: ${lead.source || "N/A"}
- Status: ${lead.status || "N/A"}
- Current Score: ${lead.score ?? "Not scored"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Win Probability: ${lead.win_probability ? `${lead.win_probability}%` : "N/A"}
- Created: ${lead.created_at || "N/A"}
- Last Updated: ${lead.updated_at || "N/A"}`);

  // Qualification data (BANT/MEDDIC) if available
  if (lead.qualification_data) {
    sections.push(
      `## Qualification Data\n${JSON.stringify(lead.qualification_data, null, 2)}`
    );
  }

  // Scoring profile weights/criteria
  if (scoringProfile) {
    sections.push(`## Scoring Profile: ${scoringProfile.name}
- Weight Company Size: ${scoringProfile.weight_company_size}
- Weight Industry Fit: ${scoringProfile.weight_industry_fit}
- Weight Engagement: ${scoringProfile.weight_engagement}
- Weight Source Quality: ${scoringProfile.weight_source_quality}
- Weight Budget: ${scoringProfile.weight_budget}
- Target Industries: ${(scoringProfile.target_industries as string[])?.join(", ") || "N/A"}
- Target Company Sizes: ${(scoringProfile.target_company_sizes as string[])?.join(", ") || "N/A"}
- Source Rankings: ${JSON.stringify(scoringProfile.source_rankings)}`);
  }

  // Recent activities
  if (activities.length > 0) {
    const activityLines = activities
      .map(
        (a) =>
          `- [${a.type}] ${a.description || "No description"} (${a.created_at})`
      )
      .join("\n");
    sections.push(`## Recent Activities (${activities.length})\n${activityLines}`);
  } else {
    sections.push("## Recent Activities\nNo recent activities recorded.");
  }

  // Recent notes
  if (notes.length > 0) {
    const noteLines = notes
      .map((n) => `- ${n.content} (${n.created_at})`)
      .join("\n");
    sections.push(`## Recent Notes (${notes.length})\n${noteLines}`);
  } else {
    sections.push("## Recent Notes\nNo notes recorded.");
  }

  // Score history
  if (scoreHistory.length > 0) {
    const historyLines = scoreHistory
      .map(
        (h) =>
          `- Score: ${h.score} | Breakdown: ${JSON.stringify(h.breakdown)} (${h.scored_at})`
      )
      .join("\n");
    sections.push(
      `## Previous Score History (${scoreHistory.length})\n${historyLines}`
    );
  } else {
    sections.push(
      "## Previous Score History\nNo previous scores. This is the first AI scoring."
    );
  }

  sections.push(
    "\nPlease analyze all the above data and return a JSON score result."
  );

  return sections.join("\n\n");
}
