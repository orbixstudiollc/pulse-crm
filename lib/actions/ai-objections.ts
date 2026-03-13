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

interface ObjectionResponseResult {
  frameworks: Array<{ name: string; response: string }>;
  customized_response: string;
  prevention_tips: string[];
}

interface ObjectionPrediction {
  objection: string;
  likelihood: string;
  suggested_response: string;
  prevention: string;
}

// ─── aiGenerateResponse ──────────────────────────────────────────────────────

/**
 * Generate structured responses to an objection using FFR and ABC frameworks.
 * Optionally customizes the response based on lead context.
 */
export async function aiGenerateResponse(
  objectionId: string,
  leadId?: string
): Promise<ObjectionResponseResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_objections) {
      return { error: "AI objections feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch objection from playbook
    const { data: objection, error: objError } = await supabase
      .from("objection_playbook")
      .select(
        "id, objection_text, category, hidden_meaning, ffr_response, abc_response, follow_up_question, proof_point, walk_away_criteria, organization_id"
      )
      .eq("id", objectionId)
      .single();

    if (objError || !objection) {
      return {
        error: `Objection not found: ${objError?.message || "Unknown error"}`,
      };
    }

    // Optionally fetch lead data for customized response
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

    sections.push(`## Objection Details
- Objection: ${objection.objection_text}
- Category: ${objection.category || "General"}
- Hidden Meaning: ${objection.hidden_meaning || "N/A"}
- Existing FFR Response: ${objection.ffr_response || "None"}
- Existing ABC Response: ${objection.abc_response || "None"}
- Follow-Up Question: ${objection.follow_up_question || "None"}
- Proof Point: ${objection.proof_point || "None"}
- Walk-Away Criteria: ${objection.walk_away_criteria || "None"}`);

    if (lead) {
      sections.push(`## Lead Context (customize response for this lead)
- Name: ${lead.name || "N/A"}
- Company: ${lead.company || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Status: ${lead.status || "N/A"}
- Score: ${lead.score ?? "N/A"}
- Qualification Data: ${lead.qualification_data ? JSON.stringify(lead.qualification_data) : "N/A"}`);
    }

    sections.push(`
Please generate comprehensive objection handling responses. Return a JSON object with:
- frameworks: Array of { name: string, response: string } — must include at least:
  - "FFR (Feel, Felt, Found)" framework response
  - "ABC (Acknowledge, Bridge, Close)" framework response
- customized_response: string (a tailored response${lead ? " customized for the specific lead" : " that can be adapted to different situations"})
- prevention_tips: string[] (3-5 tips to prevent this objection from arising in the first place)

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: getModelId("sonnet", settings?.ai_provider),
      max_tokens: 1536,
      system: SYSTEM_PROMPTS.objection_response,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: ObjectionResponseResult;
    try {
      parsed = parseJSON<ObjectionResponseResult>(text);
    } catch {
      return { error: "Failed to parse AI objection response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "objections",
      model: getModelId("sonnet", settings?.ai_provider),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { objectionId, leadId, function: "aiGenerateResponse" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.message
        : "AI objection response generation failed";

    try {
      const { settings: errSettings, orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "objections",
        model: getModelId("sonnet", errSettings?.ai_provider),
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { objectionId, leadId, function: "aiGenerateResponse" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ─── aiPredictObjections ─────────────────────────────────────────────────────

/**
 * Predict likely objections for a lead based on their profile, qualification data,
 * activities, and competitive context. Returns 5-8 predictions with responses.
 */
export async function aiPredictObjections(
  leadId: string
): Promise<
  { predictions: Array<ObjectionPrediction> } | { error: string }
> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_objections) {
      return { error: "AI objections feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, name, email, company, industry, employees, estimated_value, source, status, score, win_probability, qualification_data, organization_id"
      )
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { error: `Lead not found: ${leadError?.message || "Unknown error"}` };
    }

    // Fetch activities for this lead
    const { data: activities } = await supabase
      .from("lead_activities")
      .select("id, type, title, description, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch competitors for context
    const { data: competitors } = await supabase
      .from("competitors")
      .select("id, name, category, strengths, weaknesses")
      .eq("organization_id", orgId)
      .limit(10);

    // Fetch existing objection playbook for context
    const { data: playbook } = await supabase
      .from("objection_playbook")
      .select("id, objection_text, category")
      .eq("organization_id", orgId)
      .limit(20);

    // Build the prompt
    const sections: string[] = [];

    sections.push(`## Lead Profile
- Name: ${lead.name || "N/A"}
- Company: ${lead.company || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Source: ${lead.source || "N/A"}
- Status: ${lead.status || "N/A"}
- Score: ${lead.score ?? "Not scored"}
- Win Probability: ${lead.win_probability ? `${lead.win_probability}%` : "N/A"}`);

    if (lead.qualification_data) {
      sections.push(
        `## Qualification Data (BANT/MEDDIC)\n${JSON.stringify(lead.qualification_data, null, 2)}`
      );
    }

    if (activities && activities.length > 0) {
      const activityLines = activities
        .map(
          (a) =>
            `- [${a.type}] ${a.description || "No description"} (${a.created_at})`
        )
        .join("\n");
      sections.push(`## Recent Activities (${activities.length})\n${activityLines}`);
    }

    if (competitors && competitors.length > 0) {
      const compLines = competitors
        .map(
          (c) =>
            `- ${c.name} (${c.category || "N/A"}): Strengths: ${(c.strengths || []).join(", ")}`
        )
        .join("\n");
      sections.push(`## Known Competitors (${competitors.length})\n${compLines}`);
    }

    if (playbook && playbook.length > 0) {
      const playbookLines = playbook
        .map((p) => `- [${p.category || "General"}] ${p.objection_text}`)
        .join("\n");
      sections.push(
        `## Existing Objection Playbook (${playbook.length} entries)\n${playbookLines}`
      );
    }

    sections.push(`
Based on the lead's profile, qualification gaps, activity patterns, and competitive landscape, predict the most likely objections this lead will raise. Return a JSON object with:
- predictions: Array of { objection: string, likelihood: string, suggested_response: string, prevention: string }

Where likelihood is one of: "high", "medium", "low"
Generate 5-8 likely objections ordered by likelihood (highest first).
Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: getModelId("sonnet", settings?.ai_provider),
      max_tokens: 2048,
      system:
        "You are a sales objection prediction expert. Analyze lead data, qualification gaps, activity patterns, and competitive context to predict the most likely objections a lead will raise during the sales process. Be specific and actionable. Return ONLY valid JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: { predictions: Array<ObjectionPrediction> };
    try {
      parsed = parseJSON<{ predictions: Array<ObjectionPrediction> }>(text);
    } catch {
      return { error: "Failed to parse AI objection predictions response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "objections",
      model: getModelId("sonnet", settings?.ai_provider),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { leadId, function: "aiPredictObjections" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.message
        : "AI objection prediction failed";

    try {
      const { settings: errSettings, orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "objections",
        model: getModelId("sonnet", errSettings?.ai_provider),
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { leadId, function: "aiPredictObjections" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}
