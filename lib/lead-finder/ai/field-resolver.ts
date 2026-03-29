import "server-only";

import { generateCompletion, logLlmCost } from "../ai-provider";
import type { AIProvider, ActorDefinition } from "../types";

// =============================================================================
// Field Resolver – AI-powered resolution of Apify actor input fields
// =============================================================================

/**
 * Given a target niche/description and an actor definition, use AI to
 * generate optimal input values for the actor's required fields.
 *
 * Example: for Google Maps Scraper with niche "plumbers in Austin",
 * this would produce: { searchStringsArray: ["plumbers in Austin TX", "plumbing services Austin"] }
 */
export async function resolveActorInput(
  actorDef: ActorDefinition,
  targetNiche: string,
  orgId: string,
  aiProvider: AIProvider = "anthropic",
  campaignId?: string,
  existingInput?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const fieldDescriptions = actorDef.inputFieldDescriptions ?? {};
  const requiredFields = actorDef.requiredInputFields;

  // If no required fields, just use default input
  if (requiredFields.length === 0) {
    return actorDef.defaultInput ?? {};
  }

  const fieldsPrompt = requiredFields
    .map((fieldId) => {
      const desc = fieldDescriptions[fieldId];
      return desc
        ? `- ${fieldId} (${desc.type}): ${desc.label} – ${desc.helpText}`
        : `- ${fieldId}: (no description available)`;
    })
    .join("\n");

  // Include all optional fields too for better context
  const allFieldIds = Object.keys(fieldDescriptions);
  const optionalFields = allFieldIds.filter(
    (f) => !requiredFields.includes(f)
  );
  const optionalPrompt =
    optionalFields.length > 0
      ? `\nOptional fields you may also set:\n${optionalFields
          .map((fieldId) => {
            const desc = fieldDescriptions[fieldId];
            return desc
              ? `- ${fieldId} (${desc.type}): ${desc.label} – ${desc.helpText}`
              : `- ${fieldId}`;
          })
          .join("\n")}`
      : "";

  const existingPrompt = existingInput
    ? `\nExisting input (fill in missing fields, you may override if better values exist):\n${JSON.stringify(existingInput, null, 2)}`
    : "";

  const prompt = `You are configuring an Apify actor to find leads.

Actor: ${actorDef.name}
Description: ${actorDef.description}
Target niche/market: ${targetNiche}

Required input fields:
${fieldsPrompt}
${optionalPrompt}
${existingPrompt}

Generate optimal input values that will find the most relevant leads for the target niche.
For string-array fields, provide 3-5 varied search terms to maximize coverage.

Respond in JSON with field IDs as keys. Only include fields that have meaningful values.`;

  const response = await generateCompletion(
    [
      {
        role: "system",
        content:
          "You are an expert at configuring web scraping actors for lead generation. Respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    aiProvider,
    orgId,
    { temperature: 0.5, maxTokens: 1024 }
  );

  await logLlmCost(response, "field-resolution", orgId, campaignId);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return actorDef.defaultInput ?? {};

    const resolved = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Merge with defaults (resolved values take precedence)
    return { ...(actorDef.defaultInput ?? {}), ...resolved };
  } catch {
    return actorDef.defaultInput ?? {};
  }
}
