import { AIFeature, AIModel } from "./types";

export const MODEL_MAP: Record<AIModel, string> = {
  haiku: "claude-3-5-haiku-20241022",
  sonnet: "claude-sonnet-4-20250514",
};

// OpenRouter requires "anthropic/" prefix for model IDs
export const OPENROUTER_MODEL_MAP: Record<AIModel, string> = {
  haiku: "anthropic/claude-3-5-haiku-20241022",
  sonnet: "anthropic/claude-sonnet-4-20250514",
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
};

export function getModelId(model: AIModel, provider?: string | null): string {
  if (provider === "openrouter") return OPENROUTER_MODEL_MAP[model];
  return MODEL_MAP[model];
}

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

export function getModelName(modelId: string): AIModel {
  if (modelId.includes("haiku")) return "haiku";
  return "sonnet";
}
