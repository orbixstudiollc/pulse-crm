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
  return JSON.parse(jsonStr);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateResult {
  name: string;
  subject: string;
  body: string;
}

interface OptimizeCopyResult {
  optimized: string;
  changes: string[];
  score_before: number;
  score_after: number;
}

// ---------------------------------------------------------------------------
// 1. aiGenerateTemplate
// ---------------------------------------------------------------------------

/**
 * Generate a reusable email template for a given category using Claude Haiku.
 * Categories include: cold_outreach, follow_up, meeting_request, proposal_intro, etc.
 */
export async function aiGenerateTemplate(
  category: string,
  context?: string
): Promise<TemplateResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_outreach) {
      return { error: "AI outreach is disabled in settings" };
    }

    const sections: string[] = [];

    sections.push(`## Template Category
${category}`);

    if (context) {
      sections.push(`## Additional Context
${context}`);
    }

    sections.push(`
Please generate a reusable email template for the "${category}" category. The template should use placeholders like {{first_name}}, {{company}}, {{your_name}}, etc. where personalization would go.

Return a JSON object with:
- name: string (a descriptive template name, e.g. "Cold Outreach - Value Proposition")
- subject: string (compelling subject line with optional placeholders, under 60 chars)
- body: string (email body with placeholders, professional tone, 150-250 words)

Guidelines:
- Use {{first_name}}, {{company}}, {{industry}}, {{your_name}}, {{your_company}} as placeholders
- Keep the tone professional but conversational
- Include a clear call-to-action
- Make it easy to customize for individual leads

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    // Call Claude Haiku (simpler task)
    const response = await client.messages.create({
      model: getModelId("haiku", settings?.ai_provider),
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.outreach_email,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: TemplateResult;
    try {
      parsed = parseJSON<TemplateResult>(text);
    } catch {
      return { error: "Failed to parse AI template response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "outreach",
      model: getModelId("haiku", settings?.ai_provider),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { type: "template", category },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI template generation failed";

    try {
      const { settings: errSettings, orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "outreach",
        model: getModelId("haiku", errSettings?.ai_provider),
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { type: "template", category },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// 2. aiOptimizeCopy
// ---------------------------------------------------------------------------

/**
 * Optimize existing copy using Claude Haiku.
 * Improves the text and returns the optimized version with change list and quality scores.
 */
export async function aiOptimizeCopy(
  text: string,
  params?: { tone?: string; goal?: string }
): Promise<OptimizeCopyResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_outreach) {
      return { error: "AI outreach is disabled in settings" };
    }

    const tone = params?.tone || "professional";
    const goal = params?.goal || "increase engagement and response rate";

    const sections: string[] = [];

    sections.push(`## Original Copy
${text}`);

    sections.push(`## Optimization Parameters
- Desired Tone: ${tone}
- Goal: ${goal}`);

    sections.push(`
Please optimize the copy above. Return a JSON object with:
- optimized: string (the improved version of the text)
- changes: string[] (list of specific changes made and why, e.g. "Shortened opening paragraph for better hook", "Added urgency with deadline mention")
- score_before: number (quality score 0-100 of the original copy)
- score_after: number (quality score 0-100 of the optimized copy)

Scoring criteria:
- Clarity and readability (25%)
- Persuasiveness and CTA strength (25%)
- Personalization potential (20%)
- Professional tone alignment (15%)
- Length appropriateness (15%)

Maintain the core message while improving:
- Opening hook
- Value proposition clarity
- Call-to-action effectiveness
- Overall readability and flow
- Tone consistency (${tone})

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    // Call Claude Haiku (simpler task)
    const response = await client.messages.create({
      model: getModelId("haiku", settings?.ai_provider),
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.outreach_email,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: OptimizeCopyResult;
    try {
      parsed = parseJSON<OptimizeCopyResult>(responseText);
    } catch {
      return { error: "Failed to parse AI copy optimization response" };
    }

    // Clamp scores to valid range
    parsed.score_before = Math.round(
      Math.min(100, Math.max(0, parsed.score_before || 0))
    );
    parsed.score_after = Math.round(
      Math.min(100, Math.max(0, parsed.score_after || 0))
    );

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "outreach",
      model: getModelId("haiku", settings?.ai_provider),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: {
        type: "copy_optimization",
        tone,
        goal,
        scoreBefore: parsed.score_before,
        scoreAfter: parsed.score_after,
      },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI copy optimization failed";

    try {
      const { settings: errSettings, orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "outreach",
        model: getModelId("haiku", errSettings?.ai_provider),
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { type: "copy_optimization" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}
