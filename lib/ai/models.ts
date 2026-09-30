import { AIFeature, AIModel } from "./types";
import { customModelFor, type CustomModelSettings } from "./custom-provider";

// Direct Anthropic API model IDs
export const MODEL_MAP: Record<AIModel, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
};

// OpenRouter uses simplified model IDs with "anthropic/" prefix
export const OPENROUTER_MODEL_MAP: Record<AIModel, string> = {
  haiku: "anthropic/claude-haiku-4.5",
  sonnet: "anthropic/claude-sonnet-4.6",
};

type Complexity = "simple" | "complex";

export const FEATURE_COMPLEXITY: Record<AIFeature, Complexity> = {
  lead_scoring: "simple",
  icp_matching: "simple",
  outreach: "complex",
  proposals: "complex",
  meetings: "complex",
  analytics: "complex",
  competitors: "complex",
  objections: "complex",
  chat: "complex",
  lead_validation: "simple",
  import_enrichment: "simple",
  memory_scrape: "simple",
  marketing: "complex",
};

/**
 * Resolve the correct model ID string for a given provider. For "custom" the
 * org's configured model for the tier is used (Claude ID if none is known).
 */
export function getModelId(
  model: AIModel,
  provider?: string | null,
  settings?: CustomModelSettings | null
): string {
  if (provider === "openrouter") return OPENROUTER_MODEL_MAP[model];
  if (provider === "custom") return customModelFor(model, settings ?? {}) ?? MODEL_MAP[model];
  return MODEL_MAP[model];
}

/**
 * Get the model ID for a feature, using complexity mapping or an override.
 */
export function getModelForFeature(
  feature: AIFeature,
  override?: AIModel,
  provider?: string | null
): string {
  const model = override || (FEATURE_COMPLEXITY[feature] === "simple" ? "haiku" : "sonnet");
  return getModelId(model as AIModel, provider);
}

export function getModelForComplexity(complexity: Complexity, provider?: string | null): string {
  const model: AIModel = complexity === "simple" ? "haiku" : "sonnet";
  return getModelId(model, provider);
}

/**
 * Reverse-map a model ID string back to our internal AIModel name.
 */
export function getModelName(modelId: string): AIModel {
  if (modelId.includes("haiku")) return "haiku";
  return "sonnet";
}

/**
 * Convert a model ID from one provider format to another.
 * Used by the fallback system to re-resolve the model for a different provider.
 */
export function convertModelForProvider(
  modelId: string,
  targetProvider: string | null,
  settings?: CustomModelSettings | null
): string {
  // A configured custom fast model is the haiku tier even without "haiku" in its name.
  const isCustomFast = !!settings?.custom_fast_model && modelId === settings.custom_fast_model.trim();
  const internalModel: AIModel = isCustomFast ? "haiku" : getModelName(modelId);
  return getModelId(internalModel, targetProvider, settings);
}
