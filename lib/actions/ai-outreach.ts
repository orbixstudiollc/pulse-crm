"use server";

import { createClient } from "@/lib/supabase/server";
import { getAIClient, logTokenUsage } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { MODEL_MAP } from "@/lib/ai/models";
import { revalidatePath } from "next/cache";

/**
 * Parse a JSON response from the AI, handling markdown code block wrappers.
 */
function parseJSON<T>(text: string): T {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailResult {
  subject: string;
  body: string;
  alternatives: Array<{ subject: string; body: string }>;
}

interface SequenceStep {
  step_number: number;
  type: string;
  subject: string;
  body: string;
  delay_days: number;
}

interface SequenceResult {
  sequence_name: string;
  steps: SequenceStep[];
}

interface SubjectVariant {
  subject: string;
  reasoning: string;
}

interface SubjectLineResult {
  variants: SubjectVariant[];
}

// ---------------------------------------------------------------------------
// 1. aiGenerateEmail
// ---------------------------------------------------------------------------

/**
 * Generate a personalized outreach email for a lead using Claude Sonnet.
 * Fetches lead data, recent activities, and notes for context.
 */
export async function aiGenerateEmail(
  leadId: string,
  context?: string
): Promise<EmailResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_outreach) {
      return { error: "AI outreach is disabled in settings" };
    }

    const supabase = await createClient();

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

    // Fetch recent activities for context
    const { data: activities } = await supabase
      .from("activities")
      .select("id, type, description, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch recent notes for context
    const { data: notes } = await supabase
      .from("lead_notes")
      .select("id, content, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Build prompt
    const sections: string[] = [];

    sections.push(`## Lead Profile
- Name: ${lead.name || "N/A"}
- Email: ${lead.email || "N/A"}
- Company: ${lead.company || "N/A"}
- Website: ${lead.website || "N/A"}
- LinkedIn: ${lead.linkedin || "N/A"}
- Source: ${lead.source || "N/A"}
- Status: ${lead.status || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Win Probability: ${lead.win_probability ? `${lead.win_probability}%` : "N/A"}`);

    if (lead.qualification_data) {
      sections.push(
        `## Qualification Data\n${JSON.stringify(lead.qualification_data, null, 2)}`
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

    if (notes && notes.length > 0) {
      const noteLines = notes
        .map((n) => `- ${n.content} (${n.created_at})`)
        .join("\n");
      sections.push(`## Recent Notes (${notes.length})\n${noteLines}`);
    }

    if (context) {
      sections.push(`## Additional Context\n${context}`);
    }

    sections.push(`
Please generate a personalized outreach email for this lead. Return a JSON object with:
- subject: string (compelling subject line, under 60 chars)
- body: string (email body, professional but conversational, 150-250 words)
- alternatives: Array of 2 objects, each with { subject: string, body: string } (alternative email versions with different angles)

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    // Call Claude Sonnet
    const response = await client.messages.create({
      model: MODEL_MAP.sonnet,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.outreach_email,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: EmailResult;
    try {
      parsed = parseJSON<EmailResult>(text);
    } catch {
      return { error: "Failed to parse AI email response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "outreach",
      model: MODEL_MAP.sonnet,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { leadId, type: "email" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI email generation failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "outreach",
        model: MODEL_MAP.sonnet,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { leadId, type: "email" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// 2. aiGenerateSequence
// ---------------------------------------------------------------------------

/**
 * Generate a multi-step outreach sequence for a lead using Claude Sonnet.
 * Each step includes step_number, type, subject, body, and delay_days.
 */
export async function aiGenerateSequence(
  leadId: string,
  params?: { steps?: number; goal?: string }
): Promise<SequenceResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_outreach) {
      return { error: "AI outreach is disabled in settings" };
    }

    const supabase = await createClient();

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

    const stepCount = params?.steps || 5;
    const goal = params?.goal || "book a discovery call";

    // Build prompt
    const sections: string[] = [];

    sections.push(`## Lead Profile
- Name: ${lead.name || "N/A"}
- Email: ${lead.email || "N/A"}
- Company: ${lead.company || "N/A"}
- Website: ${lead.website || "N/A"}
- LinkedIn: ${lead.linkedin || "N/A"}
- Source: ${lead.source || "N/A"}
- Status: ${lead.status || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Win Probability: ${lead.win_probability ? `${lead.win_probability}%` : "N/A"}`);

    if (lead.qualification_data) {
      sections.push(
        `## Qualification Data\n${JSON.stringify(lead.qualification_data, null, 2)}`
      );
    }

    sections.push(`## Sequence Parameters
- Number of steps: ${stepCount}
- Goal: ${goal}`);

    sections.push(`
Please generate a multi-step outreach sequence for this lead. Return a JSON object with:
- sequence_name: string (a descriptive name for this sequence)
- steps: Array of ${stepCount} objects, each with:
  - step_number: number (1-based)
  - type: "email" | "follow_up" | "linkedin" (the channel for this step)
  - subject: string (subject line for emails, or action title for linkedin)
  - body: string (email body or linkedin message, 100-200 words each)
  - delay_days: number (days to wait after the previous step, 0 for first step)

Design the sequence with increasing urgency while maintaining professionalism.
Mix email and linkedin touchpoints. The goal is to ${goal}.

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    // Call Claude Sonnet
    const response = await client.messages.create({
      model: MODEL_MAP.sonnet,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.outreach_sequence,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: SequenceResult;
    try {
      parsed = parseJSON<SequenceResult>(text);
    } catch {
      return { error: "Failed to parse AI sequence response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "outreach",
      model: MODEL_MAP.sonnet,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { leadId, type: "sequence", stepCount },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI sequence generation failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "outreach",
        model: MODEL_MAP.sonnet,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { leadId, type: "sequence" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// 3. aiOptimizeSubjectLine
// ---------------------------------------------------------------------------

/**
 * Generate 5 A/B test subject line variants using Claude Haiku.
 * Optionally fetches lead data for personalization context.
 */
export async function aiOptimizeSubjectLine(
  subject: string,
  leadId?: string
): Promise<SubjectLineResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_outreach) {
      return { error: "AI outreach is disabled in settings" };
    }

    const sections: string[] = [];

    // Optionally fetch lead for context
    if (leadId) {
      const supabase = await createClient();
      const { data: lead } = await supabase
        .from("leads")
        .select(
          "id, name, company, industry, employees, source, status, estimated_value"
        )
        .eq("id", leadId)
        .single();

      if (lead) {
        sections.push(`## Lead Context
- Name: ${lead.name || "N/A"}
- Company: ${lead.company || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Source: ${lead.source || "N/A"}
- Status: ${lead.status || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}`);
      }
    }

    sections.push(`## Original Subject Line
"${subject}"`);

    sections.push(`
Please generate 5 A/B test subject line variants for the original subject line above. Return a JSON object with:
- variants: Array of 5 objects, each with:
  - subject: string (optimized subject line, under 60 chars)
  - reasoning: string (brief explanation of the approach and why it should perform well)

Focus on different angles: curiosity, personalization, urgency, value proposition, and social proof.

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    // Call Claude Haiku (simpler task)
    const response = await client.messages.create({
      model: MODEL_MAP.haiku,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.subject_line,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: SubjectLineResult;
    try {
      parsed = parseJSON<SubjectLineResult>(text);
    } catch {
      return { error: "Failed to parse AI subject line response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "outreach",
      model: MODEL_MAP.haiku,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { type: "subject_line", originalSubject: subject, leadId },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI subject line optimization failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "outreach",
        model: MODEL_MAP.haiku,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { type: "subject_line", originalSubject: subject, leadId },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}
