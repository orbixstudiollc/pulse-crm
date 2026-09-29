import "server-only";

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { AIProvider, AIMessage, AIResponse } from "./types";
import {
  getApifyToken as resolveApifyToken,
  getApifyTokenFromEnv,
} from "./apify/token";
import { assertSafeFetchTarget } from "@/lib/security/fetch-target";
import { createPinnedFetch } from "@/lib/security/safe-fetch";

// =============================================================================
// Model Pricing (USD per 1M tokens)
// =============================================================================

const MODEL_PRICING: Record<
  string,
  { inputPer1M: number; outputPer1M: number }
> = {
  // OpenAI / Anthropic direct
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-sonnet-4-5": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-haiku-4-5-20251001": { inputPer1M: 0.8, outputPer1M: 4.0 },

  // OpenRouter models
  "anthropic/claude-sonnet-4": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "anthropic/claude-sonnet-4-5": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "openai/gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "google/gemini-2.5-flash": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "google/gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "meta-llama/llama-4-maverick": { inputPer1M: 0.2, outputPer1M: 0.6 },
  "deepseek/deepseek-r1": { inputPer1M: 0.55, outputPer1M: 2.19 },

  // Groq models
  "llama-4-maverick-17b-128e-instruct": { inputPer1M: 0.5, outputPer1M: 0.77 },
  "llama-4-scout-17b-16e-instruct": { inputPer1M: 0.11, outputPer1M: 0.34 },
  "qwen-qwq-32b": { inputPer1M: 0.29, outputPer1M: 0.39 },
  "deepseek-r1-distill-llama-70b": { inputPer1M: 0.75, outputPer1M: 0.99 },
  "gemma2-9b-it": { inputPer1M: 0.2, outputPer1M: 0.2 },
  "mixtral-8x7b-32768": { inputPer1M: 0.24, outputPer1M: 0.24 },
  "llama3-70b-8192": { inputPer1M: 0.59, outputPer1M: 0.79 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? {
    inputPer1M: 0,
    outputPer1M: 0,
  };
  return (
    (inputTokens * pricing.inputPer1M +
      outputTokens * pricing.outputPer1M) /
    1_000_000
  );
}

// =============================================================================
// Model registries (shared with UI)
// =============================================================================

export const OPENROUTER_MODELS = [
  { value: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5 (Anthropic)" },
  { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (Anthropic)" },
  { value: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Google)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Google)" },
  { value: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick (Meta)" },
  { value: "deepseek/deepseek-r1", label: "DeepSeek R1" },
] as const;

export const GROQ_MODELS = [
  { value: "llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick — Recommended" },
  { value: "llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout (Fastest)" },
  { value: "qwen-qwq-32b", label: "Qwen QwQ 32B (Reasoning)" },
  { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B (Reasoning)" },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
  { value: "gemma2-9b-it", label: "Gemma 2 9B (Fast & Free)" },
  { value: "llama3-70b-8192", label: "Llama 3 70B" },
] as const;

export const OLLAMA_MODELS = [
  { value: "llama3.1", label: "Llama 3.1 8B" },
  { value: "llama3.2", label: "Llama 3.2 3B" },
  { value: "llama3.2:1b", label: "Llama 3.2 1B (Fastest)" },
  { value: "mistral", label: "Mistral 7B" },
  { value: "qwen2.5", label: "Qwen 2.5 7B" },
  { value: "qwen2.5-coder", label: "Qwen 2.5 Coder 7B" },
  { value: "deepseek-r1", label: "DeepSeek R1 7B (Reasoning)" },
  { value: "phi4", label: "Phi-4 14B (Microsoft)" },
] as const;

export const OLLAMA_CLOUD_MODELS = [
  { value: "gemma4:31b", label: "Gemma 4 31B — Recommended" },
  { value: "gemma3:27b", label: "Gemma 3 27B" },
  { value: "gemma3:12b", label: "Gemma 3 12B" },
  { value: "gemma3:4b", label: "Gemma 3 4B (Fast)" },
  { value: "qwen3.5:397b", label: "Qwen 3.5 397B (Powerful)" },
  { value: "qwen3-next:80b", label: "Qwen 3 80B" },
  { value: "qwen3-coder:480b", label: "Qwen 3 Coder 480B" },
  { value: "qwen3-vl:235b", label: "Qwen 3 VL 235B (Vision)" },
  { value: "glm-5.1", label: "GLM-5.1 (Agentic)" },
  { value: "deepseek-v3.2", label: "DeepSeek V3.2" },
  { value: "kimi-k2-thinking", label: "Kimi K2 Thinking" },
  { value: "gpt-oss:120b", label: "GPT OSS 120B" },
  { value: "gpt-oss:20b", label: "GPT OSS 20B (Fast)" },
] as const;

// =============================================================================
// DB-backed settings resolution
// =============================================================================

export type OrgAiSettings = {
  ai_provider: AIProvider | null;
  default_model: string | null;
  api_key: string | null;
  openai_api_key: string | null;
  openrouter_api_key: string | null;
  openrouter_oauth_token: string | null;
  openrouter_expires_at: string | null;
  groq_api_key: string | null;
  ollama_base_url: string | null;
  apify_api_key: string | null;
};

async function loadOrgSettings(orgId: string): Promise<OrgAiSettings | null> {
  // Admin client: workers/cron have no cookie session; scoped by organization_id.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_settings")
    .select(
      "ai_provider, default_model, api_key, openai_api_key, openrouter_api_key, openrouter_oauth_token, openrouter_expires_at, groq_api_key, ollama_base_url, apify_api_key"
    )
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();
  return (data as OrgAiSettings | null) ?? null;
}

async function getApiKeys(orgId: string): Promise<{
  anthropicKey?: string;
  openaiKey?: string;
  openrouterKey?: string;
  groqKey?: string;
  ollamaBaseUrl?: string;
  ollamaCloudKey?: string;
  apifyToken?: string;
}> {
  const data = await loadOrgSettings(orgId);

  // Prefer a live OAuth token over a PAT when still valid
  const now = Date.now();
  const orExpires = data?.openrouter_expires_at
    ? Date.parse(data.openrouter_expires_at)
    : 0;
  const orOauth =
    data?.openrouter_oauth_token && orExpires > now
      ? data.openrouter_oauth_token
      : null;

  return {
    anthropicKey:
      data?.api_key || process.env.ANTHROPIC_API_KEY || undefined,
    openaiKey: data?.openai_api_key || process.env.OPENAI_API_KEY || undefined,
    openrouterKey:
      orOauth ||
      data?.openrouter_api_key ||
      process.env.OPENROUTER_API_KEY ||
      undefined,
    groqKey: data?.groq_api_key || process.env.GROQ_API_KEY || undefined,
    ollamaBaseUrl:
      data?.ollama_base_url ||
      process.env.OLLAMA_BASE_URL ||
      "http://localhost:11434/v1",
    ollamaCloudKey: process.env.OLLAMA_CLOUD_API_KEY || undefined,
    apifyToken:
      data?.apify_api_key || getApifyTokenFromEnv() || undefined,
  };
}

/**
 * Retrieve the Apify token for a given org, or throw.
 *
 * Kept as a thin re-export from `./apify/token` so existing callers
 * (`@/lib/lead-finder/ai-provider`) continue to work while the canonical
 * implementation lives under `lib/lead-finder/apify/`.
 */
export async function getApifyToken(orgId: string): Promise<string> {
  return resolveApifyToken(orgId);
}

/** Resolve the active provider and model for an org. */
export async function resolveProviderAndModel(
  orgId: string,
  hint?: AIProvider
): Promise<{ provider: AIProvider; model: string }> {
  const settings = await loadOrgSettings(orgId);
  const keys = await getApiKeys(orgId);

  const configured = (settings?.ai_provider as AIProvider | null) ?? null;
  const provider: AIProvider =
    configured ||
    hint ||
    (keys.openrouterKey
      ? "openrouter"
      : keys.anthropicKey
        ? "anthropic"
        : keys.openaiKey
          ? "openai"
          : keys.groqKey
            ? "groq"
            : "openrouter");

  // Rows written by the old settings route hold "ollama:<url>:<model>" here;
  // ignore them so the provider default is used until settings are re-saved.
  const raw = settings?.default_model ?? null;
  const defaultModel = raw && raw.startsWith("ollama:") ? null : raw;
  let model = defaultModel ?? "";
  if (!model) {
    switch (provider) {
      case "openrouter":
        model = "anthropic/claude-sonnet-4-5";
        break;
      case "anthropic":
        model = "claude-sonnet-4-6";
        break;
      case "openai":
        model = "gpt-4o";
        break;
      case "groq":
        model = "llama-4-maverick-17b-128e-instruct";
        break;
      case "ollama":
        model = "llama3.1";
        break;
      case "ollama_cloud":
        model = "gemma4:31b";
        break;
    }
  }

  return { provider, model };
}

// =============================================================================
// Main completion wrapper
// =============================================================================

export async function generateCompletion(
  messages: AIMessage[],
  providerHint: AIProvider,
  orgId: string,
  options?: { temperature?: number; maxTokens?: number; model?: string }
): Promise<AIResponse> {
  const keys = await getApiKeys(orgId);
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 2048;

  const { provider, model: defaultModel } = await resolveProviderAndModel(
    orgId,
    providerHint
  );
  const model = options?.model || defaultModel;

  // --- Ollama Cloud (api.ollama.com) ---
  if (provider === "ollama_cloud") {
    const apiKey = keys.ollamaCloudKey;
    if (!apiKey) {
      throw new Error(
        "Ollama Cloud API key not configured. Set OLLAMA_CLOUD_API_KEY."
      );
    }
    const res = await fetch("https://api.ollama.com/api/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature, num_predict: maxTokens },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama Cloud error ${res.status}: ${err}`);
    }
    const data = (await res.json()) as {
      message: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const inputTokens = data.prompt_eval_count ?? 0;
    const outputTokens = data.eval_count ?? 0;
    return {
      content: data.message?.content ?? "",
      provider: "ollama_cloud",
      model,
      inputTokens,
      outputTokens,
      costUsd: 0,
    };
  }

  // --- Ollama (local) ---
  if (provider === "ollama") {
    const baseURL = keys.ollamaBaseUrl!;
    // SECURITY (SSRF): the Ollama base URL is tenant-configurable via
    // ai_settings.ollama_base_url. Although the settings route validates it,
    // re-assert at use time so the server never issues a request to private
    // networks / loopback / metadata hosts even if the DB is tampered with.
    // The resolved addresses are pinned for the connection (no DNS rebinding).
    let target;
    try {
      target = await assertSafeFetchTarget(baseURL);
    } catch {
      throw new Error("Configured Ollama base URL is not allowed");
    }
    const pinned = createPinnedFetch(target);
    try {
      const client = new OpenAI({ baseURL, apiKey: "ollama", fetch: pinned.fetch });
      const res = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });
      const inputTokens = res.usage?.prompt_tokens ?? 0;
      const outputTokens = res.usage?.completion_tokens ?? 0;
      return {
        content: res.choices[0]?.message?.content ?? "",
        provider: "ollama",
        model,
        inputTokens,
        outputTokens,
        costUsd: 0,
      };
    } finally {
      await pinned.close();
    }
  }

  // --- Groq ---
  if (provider === "groq") {
    const apiKey = keys.groqKey;
    if (!apiKey) {
      throw new Error(
        "Groq API key not configured. Set it in Lead Finder Settings or as GROQ_API_KEY."
      );
    }
    const client = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey,
    });
    const res = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    const inputTokens = res.usage?.prompt_tokens ?? 0;
    const outputTokens = res.usage?.completion_tokens ?? 0;
    return {
      content: res.choices[0]?.message?.content ?? "",
      provider: "groq",
      model,
      inputTokens,
      outputTokens,
      costUsd: calculateCost(model, inputTokens, outputTokens),
    };
  }

  // --- OpenAI direct ---
  if (provider === "openai") {
    const apiKey = keys.openaiKey;
    if (!apiKey) {
      throw new Error(
        "OpenAI API key not configured. Set it in Lead Finder Settings or as OPENAI_API_KEY."
      );
    }
    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    const inputTokens = res.usage?.prompt_tokens ?? 0;
    const outputTokens = res.usage?.completion_tokens ?? 0;
    return {
      content: res.choices[0]?.message?.content ?? "",
      provider: "openai",
      model,
      inputTokens,
      outputTokens,
      costUsd: calculateCost(model, inputTokens, outputTokens),
    };
  }

  // --- OpenRouter (preferred cloud) ---
  if (provider === "openrouter") {
    const apiKey = keys.openrouterKey;
    if (!apiKey) {
      throw new Error(
        "OpenRouter API key not configured. Connect OpenRouter in Lead Finder Settings or set OPENROUTER_API_KEY."
      );
    }
    const client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "https://app.pulse-crm.local",
        "X-Title": "Pulse CRM – Lead Finder",
      },
    });
    const res = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    const inputTokens = res.usage?.prompt_tokens ?? 0;
    const outputTokens = res.usage?.completion_tokens ?? 0;
    return {
      content: res.choices[0]?.message?.content ?? "",
      provider: "openrouter",
      model,
      inputTokens,
      outputTokens,
      costUsd: calculateCost(model, inputTokens, outputTokens),
    };
  }

  // --- Anthropic direct SDK ---
  const apiKey = keys.anthropicKey;
  if (!apiKey) {
    throw new Error(
      "No AI API key configured. Add an Anthropic or OpenRouter key in Lead Finder Settings."
    );
  }
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
    model,
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
    model,
    inputTokens,
    outputTokens,
    costUsd: calculateCost(model, inputTokens, outputTokens),
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
  const supabase = await createClient();
  // Storage enum doesn't include ollama_cloud — collapse into "ollama"
  const providerForDb =
    response.provider === "ollama_cloud" ? "ollama" : response.provider;
  const costData = {
    organization_id: orgId,
    campaign_id: campaignId ?? null,
    provider: providerForDb,
    model: response.model,
    operation,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    cost_usd: response.costUsd,
  };
  await supabase.from("lf_llm_costs").insert(costData as never);
}
