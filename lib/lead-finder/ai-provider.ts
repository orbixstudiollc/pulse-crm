import "server-only";

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/server";
import type { AIProvider, AIMessage, AIResponse } from "./types";

// =============================================================================
// Model Pricing (USD per 1M tokens)
// =============================================================================

const MODEL_PRICING: Record<
  string,
  { inputPer1M: number; outputPer1M: number }
> = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-haiku-4-5-20251001": { inputPer1M: 0.8, outputPer1M: 4.0 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  };
  return (
    (inputTokens * pricing.inputPer1M +
      outputTokens * pricing.outputPer1M) /
    1_000_000
  );
}

// =============================================================================
// Key resolution – DB settings first, then env vars
// =============================================================================

async function getApiKeys(
  orgId: string
): Promise<{
  anthropicKey?: string;
  openrouterKey?: string;
  apifyToken?: string;
}> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("ai_settings")
    .select("api_key, apify_api_key, openrouter_api_key")
    .eq("organization_id", orgId)
    .limit(1);
  const data = rows?.[0] ?? null;

  return {
    anthropicKey:
      data?.api_key || process.env.ANTHROPIC_API_KEY || undefined,
    openrouterKey:
      data?.openrouter_api_key || process.env.OPENROUTER_API_KEY || undefined,
    apifyToken:
      data?.apify_api_key || process.env.APIFY_TOKEN || undefined,
  };
}

/** Retrieve the Apify token for a given org, or throw. */
export async function getApifyToken(orgId: string): Promise<string> {
  const keys = await getApiKeys(orgId);
  if (!keys.apifyToken)
    throw new Error(
      "Apify token not configured. Set it in Settings or as APIFY_TOKEN env var."
    );
  return keys.apifyToken;
}

// =============================================================================
// Main completion wrapper (OpenRouter / Anthropic)
// =============================================================================

export async function generateCompletion(
  messages: AIMessage[],
  provider: AIProvider,
  orgId: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<AIResponse> {
  const keys = await getApiKeys(orgId);
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 2048;

  // ── Auto-select: prefer Anthropic, fall back to OpenRouter ───────────────
  const useOpenRouter = provider === "openai" || (!keys.anthropicKey && !!keys.openrouterKey);

  if (useOpenRouter) {
    const apiKey = keys.openrouterKey;
    if (!apiKey) throw new Error("OpenRouter API key not configured. Set it in Lead Finder Settings.");

    const client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const res = await client.chat.completions.create({
      model: "anthropic/claude-sonnet-4-5",
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const inputTokens = res.usage?.prompt_tokens ?? 0;
    const outputTokens = res.usage?.completion_tokens ?? 0;

    return {
      content: res.choices[0]?.message?.content ?? "",
      provider: "openai",
      model: "claude-sonnet-4-5",
      inputTokens,
      outputTokens,
      costUsd: calculateCost("gpt-4o", inputTokens, outputTokens),
    };
  }

  // ── Anthropic direct SDK ───────────────────────────────────────────────
  const apiKey = keys.anthropicKey;
  if (!apiKey) throw new Error("No AI API key configured. Add an Anthropic or OpenRouter key in Lead Finder Settings.");
  const client = new Anthropic({ apiKey });

  const systemMessage =
    messages.find((m) => m.role === "system")?.content ?? "";
  const nonSystemMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: systemMessage,
    messages: nonSystemMessages,
  });

  const textBlock = res.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  const inputTokens = res.usage?.input_tokens ?? 0;
  const outputTokens = res.usage?.output_tokens ?? 0;

  return {
    content: textBlock?.text ?? "",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    inputTokens,
    outputTokens,
    costUsd: calculateCost(
      "claude-sonnet-4-6",
      inputTokens,
      outputTokens
    ),
  };
}

// =============================================================================
// Cost logging
// =============================================================================

export async function logLlmCost(
  response: AIResponse,
  operation: string,
  orgId: string,
  campaignId?: string
): Promise<void> {
  const supabase = createAdminClient();
  const costData = {
    organization_id: orgId,
    campaign_id: campaignId ?? null,
    provider: response.provider,
    model: response.model,
    operation,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    cost_usd: response.costUsd,
  };
  await supabase.from("lf_llm_costs").insert(costData as never);
}
