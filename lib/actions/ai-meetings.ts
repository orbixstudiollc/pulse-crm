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

interface MeetingBrief {
  lead_name: string;
  company: string;
  agenda: string[];
  talking_points: string[];
  objection_prep: Array<{ objection: string; response: string }>;
  roi_framework: string;
  discovery_questions: string[];
  background_summary: string;
}

interface SuggestedQuestion {
  question: string;
  purpose: string;
  follow_up: string;
}

// ─── aiGenerateBrief ─────────────────────────────────────────────────────────

/**
 * Generate a comprehensive meeting preparation brief for a lead.
 * Fetches lead + notes + activities + deals + qualification data + competitors,
 * then uses Claude Sonnet to produce a structured meeting brief.
 */
export async function aiGenerateBrief(
  leadId: string
): Promise<MeetingBrief | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_meetings) {
      return { error: "AI meetings feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, name, email, phone, company, website, linkedin, source, status, score, estimated_value, industry, employees, win_probability, qualification_data, organization_id"
      )
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { error: `Lead not found: ${leadError?.message || "Unknown error"}` };
    }

    // Fetch lead notes
    const { data: notes } = await supabase
      .from("lead_notes")
      .select("id, content, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch activities for this lead (lead_activities table has lead_id)
    const { data: activities } = await supabase
      .from("lead_activities")
      .select("id, type, title, description, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(15);

    // Fetch deals related to this lead's customer (if any) or by org
    const { data: deals } = await supabase
      .from("deals")
      .select(
        "id, name, value, stage, probability, close_date, contact_name, contact_email, notes, days_in_stage"
      )
      .eq("organization_id", orgId)
      .limit(10);

    // Fetch competitors for the org (for objection context)
    const { data: competitors } = await supabase
      .from("competitors")
      .select("id, name, website, category, strengths, weaknesses, pricing")
      .eq("organization_id", orgId)
      .limit(10);

    // Build the prompt
    const sections: string[] = [];

    sections.push(`## Lead Profile
- Name: ${lead.name || "N/A"}
- Email: ${lead.email || "N/A"}
- Phone: ${lead.phone || "N/A"}
- Company: ${lead.company || "N/A"}
- Website: ${lead.website || "N/A"}
- LinkedIn: ${lead.linkedin || "N/A"}
- Source: ${lead.source || "N/A"}
- Status: ${lead.status || "N/A"}
- Score: ${lead.score ?? "Not scored"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Win Probability: ${lead.win_probability ? `${lead.win_probability}%` : "N/A"}`);

    if (lead.qualification_data) {
      sections.push(
        `## Qualification Data (BANT/MEDDIC)\n${JSON.stringify(lead.qualification_data, null, 2)}`
      );
    }

    if (notes && notes.length > 0) {
      const noteLines = notes
        .map((n) => `- ${n.content} (${n.created_at})`)
        .join("\n");
      sections.push(`## Lead Notes (${notes.length})\n${noteLines}`);
    }

    if (activities && activities.length > 0) {
      const activityLines = activities
        .map(
          (a) =>
            `- [${a.type}] ${a.title}${a.description ? ": " + a.description : ""} (${a.created_at})`
        )
        .join("\n");
      sections.push(`## Recent Activities (${activities.length})\n${activityLines}`);
    }

    if (deals && deals.length > 0) {
      const dealLines = deals
        .map(
          (d) =>
            `- ${d.name}: $${d.value || 0} | Stage: ${d.stage} | Probability: ${d.probability || "N/A"}% | Close: ${d.close_date || "N/A"}`
        )
        .join("\n");
      sections.push(`## Related Deals (${deals.length})\n${dealLines}`);
    }

    if (competitors && competitors.length > 0) {
      const compLines = competitors
        .map(
          (c) =>
            `- ${c.name} (${c.category || "N/A"}): Strengths: ${(c.strengths || []).join(", ")} | Weaknesses: ${(c.weaknesses || []).join(", ")}`
        )
        .join("\n");
      sections.push(`## Known Competitors (${competitors.length})\n${compLines}`);
    }

    sections.push(`
Please generate a comprehensive meeting preparation brief. Return a JSON object with:
- lead_name: string (the lead's name)
- company: string (the lead's company)
- agenda: string[] (5-7 suggested agenda items with time allocations)
- talking_points: string[] (5-7 key talking points for the meeting)
- objection_prep: Array of { objection: string, response: string } (3-5 likely objections and prepared responses)
- roi_framework: string (how to present ROI for this specific lead)
- discovery_questions: string[] (5-7 strategic discovery questions)
- background_summary: string (2-3 paragraph summary of the lead's background and context)

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: getModelId("sonnet", settings?.ai_provider),
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.meeting_brief,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: MeetingBrief;
    try {
      parsed = parseJSON<MeetingBrief>(text);
    } catch {
      return { error: "Failed to parse AI meeting brief response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "meetings",
      model: getModelId("sonnet", settings?.ai_provider),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { leadId, function: "aiGenerateBrief" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI meeting brief generation failed";

    try {
      const { settings: errSettings, orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "meetings",
        model: getModelId("sonnet", errSettings?.ai_provider),
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { leadId, function: "aiGenerateBrief" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ─── aiSuggestQuestions ──────────────────────────────────────────────────────

/**
 * Generate targeted discovery questions based on gaps in lead qualification data.
 * Uses Claude Haiku for fast question generation.
 */
export async function aiSuggestQuestions(
  leadId: string
): Promise<{ questions: Array<SuggestedQuestion> } | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_meetings) {
      return { error: "AI meetings feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, name, email, company, industry, employees, estimated_value, status, score, win_probability, qualification_data"
      )
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { error: `Lead not found: ${leadError?.message || "Unknown error"}` };
    }

    const sections: string[] = [];

    sections.push(`## Lead Profile
- Name: ${lead.name || "N/A"}
- Company: ${lead.company || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Status: ${lead.status || "N/A"}
- Score: ${lead.score ?? "Not scored"}
- Win Probability: ${lead.win_probability ? `${lead.win_probability}%` : "N/A"}`);

    if (lead.qualification_data) {
      sections.push(
        `## Current Qualification Data (BANT/MEDDIC)\n${JSON.stringify(lead.qualification_data, null, 2)}`
      );
      sections.push(
        "Identify gaps in BANT (Budget, Authority, Need, Timeline) and MEDDIC (Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion) based on null or missing fields."
      );
    } else {
      sections.push(
        "## Qualification Data\nNo qualification data exists yet. Generate comprehensive discovery questions to fill BANT and MEDDIC frameworks."
      );
    }

    sections.push(`
Please generate targeted discovery questions based on gaps in the qualification data. Return a JSON object with:
- questions: Array of { question: string, purpose: string, follow_up: string }

Each question should:
- Target a specific gap in the qualification data
- Include why this question matters (purpose)
- Include a natural follow-up question

Generate 7-10 high-value discovery questions.
Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: getModelId("haiku", settings?.ai_provider),
      max_tokens: 1024,
      system:
        "You are a sales qualification expert. Generate targeted discovery questions to fill gaps in BANT and MEDDIC qualification frameworks. Return ONLY valid JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: { questions: Array<SuggestedQuestion> };
    try {
      parsed = parseJSON<{ questions: Array<SuggestedQuestion> }>(text);
    } catch {
      return { error: "Failed to parse AI suggested questions response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "meetings",
      model: getModelId("haiku", settings?.ai_provider),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { leadId, function: "aiSuggestQuestions" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI question suggestion failed";

    try {
      const { settings: errSettings, orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "meetings",
        model: getModelId("haiku", errSettings?.ai_provider),
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { leadId, function: "aiSuggestQuestions" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}
