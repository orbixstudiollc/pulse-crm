import { AIFeature, AIModel } from "./types";

export const MODEL_MAP: Record<AIModel, string> = {
  haiku: "claude-3-5-haiku-20241022",
  sonnet: "claude-sonnet-4-20250514",
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
};

export function getModelForFeature(
  feature: AIFeature,
  override?: AIModel
): string {
  if (override) return MODEL_MAP[override];
  const complexity = FEATURE_COMPLEXITY[feature];
  return complexity === "simple" ? MODEL_MAP.haiku : MODEL_MAP.sonnet;
}

export function getModelForComplexity(complexity: Complexity): string {
  return complexity === "simple" ? MODEL_MAP.haiku : MODEL_MAP.sonnet;
}

export function getModelName(modelId: string): AIModel {
  if (modelId.includes("haiku")) return "haiku";
  return "sonnet";
}
