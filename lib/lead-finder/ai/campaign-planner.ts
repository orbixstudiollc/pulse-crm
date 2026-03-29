import "server-only";

import { generateCompletion, logLlmCost } from "../ai-provider";
import { ACTOR_REGISTRY, ACTOR_WORKFLOWS } from "../apify/registry";
import type {
  AIProvider,
  ActorDefinition,
  KpiDefinition,
  LeadFieldDefinition,
} from "../types";

// =============================================================================
// Campaign Planner – AI-assisted campaign configuration
// =============================================================================

export interface CampaignPlan {
  name: string;
  description: string;
  targetNiche: string;
  suggestedActors: string[];
  actorConfigs: Record<string, Record<string, unknown>>;
  kpiDefinitions: KpiDefinition[];
  leadFieldDefinitions: LeadFieldDefinition[];
  enrichmentActors: string[];
  reasoning: string;
}

/**
 * Given a target niche description, use AI to plan an optimal campaign
 * configuration including actors, KPIs, and field definitions.
 */
export async function planCampaign(
  targetNiche: string,
  orgId: string,
  aiProvider: AIProvider = "anthropic",
  availableActors?: ActorDefinition[]
): Promise<CampaignPlan> {
  const actors = availableActors ?? ACTOR_REGISTRY;
  const findActors = actors.filter((a) => a.phase === "find");
  const enrichActors = actors.filter((a) => a.phase === "enrich");

  const actorsDescription = findActors
    .map(
      (a) =>
        `- ${a.id}: ${a.name} – ${a.description} (category: ${a.category})`
    )
    .join("\n");

  const enrichDescription = enrichActors
    .map((a) => `- ${a.id}: ${a.name} – ${a.description}`)
    .join("\n");

  const workflowsDescription = ACTOR_WORKFLOWS.map(
    (w) => `- ${w.id}: ${w.label} – ${w.description} (actors: ${w.actors.join(", ")})`
  ).join("\n");

  const prompt = `You are a sales lead generation strategist. Plan a lead discovery campaign.

Target niche/market: ${targetNiche}

Available discovery actors:
${actorsDescription}

Available enrichment actors:
${enrichDescription}

Pre-built workflows:
${workflowsDescription}

Design an optimal campaign plan. Select the best actors for this niche, define relevant KPIs for qualification, and suggest custom lead fields to track.

Respond in JSON:
{
  "name": "Short campaign name",
  "description": "1-2 sentence description of the campaign strategy",
  "targetNiche": "${targetNiche}",
  "suggestedActors": ["actor-id-1", "actor-id-2"],
  "actorConfigs": {
    "actor-id-1": { "field1": "value1" },
    "actor-id-2": { "field2": "value2" }
  },
  "kpiDefinitions": [
    { "id": "has_website", "label": "Has a website", "type": "boolean", "description": "Business has an active website" },
    { "id": "engagement_level", "label": "Engagement Level", "type": "text", "description": "How engaged they are online" }
  ],
  "leadFieldDefinitions": [
    { "id": "industry", "label": "Industry", "type": "text" },
    { "id": "employee_count", "label": "Employee Count", "type": "number" }
  ],
  "enrichmentActors": ["enrichment-actor-id"],
  "reasoning": "Explain your strategy in 2-3 sentences"
}`;

  const response = await generateCompletion(
    [
      {
        role: "system",
        content:
          "You are an expert lead generation strategist. Respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    aiProvider,
    orgId,
    { temperature: 0.7, maxTokens: 2048 }
  );

  await logLlmCost(response, "campaign-planning", orgId);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return defaultCampaignPlan(targetNiche);
    }

    const parsed = JSON.parse(jsonMatch[0]) as CampaignPlan;

    // Validate actor IDs exist
    const validActorIds = new Set(actors.map((a) => a.id));
    const validSuggested = (parsed.suggestedActors ?? []).filter((id) =>
      validActorIds.has(id)
    );
    const validEnrichment = (parsed.enrichmentActors ?? []).filter((id) =>
      validActorIds.has(id)
    );

    return {
      name: parsed.name || `${targetNiche} Campaign`,
      description: parsed.description || "",
      targetNiche,
      suggestedActors:
        validSuggested.length > 0
          ? validSuggested
          : ["apify/google-maps-scraper"],
      actorConfigs: parsed.actorConfigs ?? {},
      kpiDefinitions: parsed.kpiDefinitions ?? [],
      leadFieldDefinitions: parsed.leadFieldDefinitions ?? [],
      enrichmentActors: validEnrichment,
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    return defaultCampaignPlan(targetNiche);
  }
}

/**
 * Suggest lead field definitions based on a target niche.
 */
export async function suggestLeadFields(
  targetNiche: string,
  orgId: string,
  aiProvider: AIProvider = "anthropic"
): Promise<LeadFieldDefinition[]> {
  const prompt = `Suggest 5-8 custom lead fields that would be valuable for tracking leads in this market:

Target niche: ${targetNiche}

Standard fields (name, email, phone, website) are already tracked. Suggest ADDITIONAL fields specific to this niche.

Respond in JSON array:
[
  { "id": "snake_case_id", "label": "Human Label", "type": "text|number|boolean|url", "description": "Why this field matters" }
]`;

  const response = await generateCompletion(
    [
      {
        role: "system",
        content:
          "You are a CRM and sales data expert. Respond with a valid JSON array only.",
      },
      { role: "user", content: prompt },
    ],
    aiProvider,
    orgId,
    { temperature: 0.5, maxTokens: 1024 }
  );

  await logLlmCost(response, "suggest-fields", orgId);

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return defaultLeadFields();

    const parsed = JSON.parse(jsonMatch[0]) as LeadFieldDefinition[];
    return Array.isArray(parsed) ? parsed : defaultLeadFields();
  } catch {
    return defaultLeadFields();
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultCampaignPlan(targetNiche: string): CampaignPlan {
  return {
    name: `${targetNiche} Campaign`,
    description: `Lead discovery campaign targeting ${targetNiche}`,
    targetNiche,
    suggestedActors: ["apify/google-maps-scraper"],
    actorConfigs: {},
    kpiDefinitions: [
      {
        id: "has_website",
        label: "Has Website",
        type: "boolean",
        description: "Business has an active website",
      },
      {
        id: "has_email",
        label: "Has Email",
        type: "boolean",
        description: "Contact email is available",
      },
    ],
    leadFieldDefinitions: [],
    enrichmentActors: ["apify/website-content-crawler"],
    reasoning:
      "Default plan using Google Maps as the primary discovery source.",
  };
}

function defaultLeadFields(): LeadFieldDefinition[] {
  return [
    {
      id: "industry",
      label: "Industry",
      type: "text",
      description: "Business industry or category",
    },
    {
      id: "company_size",
      label: "Company Size",
      type: "text",
      description: "Employee count range",
    },
    {
      id: "annual_revenue",
      label: "Annual Revenue",
      type: "text",
      description: "Estimated annual revenue range",
    },
    {
      id: "location",
      label: "Location",
      type: "text",
      description: "Business location",
    },
  ];
}
