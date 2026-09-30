import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { assertSafeFetchTarget } from "@/lib/security/fetch-target";
import { createPinnedFetch } from "@/lib/security/safe-fetch";
import { AIFeature, AIModel, AISettings } from "./types";
import { convertModelForProvider, getModelName } from "./models";
import { createCustomFetch, type CustomModelSettings } from "./custom-provider";
import {
  AI_PROVIDER_ORDER,
  resolveAIProvider,
  type ResolvedAIProvider,
} from "./provider-resolver";

/** The part of the Anthropic SDK the CRM uses: non-streaming messages.create. */
export interface AIMessagesClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

interface AIClientResult {
  client: AIMessagesClient;
  settings: AISettings;
  orgId: string;
  userId: string;
}

type OpenAICompatibleProvider = "openai" | "groq" | "ollama";

// CRM callers ask for Claude model IDs; map them to the provider's equivalent tier.
const OPENAI_COMPATIBLE_MODELS: Record<OpenAICompatibleProvider, Record<AIModel, string>> = {
  openai: { haiku: "gpt-4o-mini", sonnet: "gpt-4o" },
  groq: { haiku: "llama-4-scout-17b-16e-instruct", sonnet: "llama-4-maverick-17b-128e-instruct" },
  ollama: { haiku: "llama3.2", sonnet: "llama3.1" },
};

function toOpenAICompatibleModel(modelId: string, provider: OpenAICompatibleProvider): string {
  if (!/claude/i.test(modelId)) return modelId;
  return OPENAI_COMPATIBLE_MODELS[provider][getModelName(modelId)];
}

function textOf(content: string | Anthropic.ContentBlockParam[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function toChatMessages(
  params: Anthropic.MessageCreateParamsNonStreaming
): OpenAI.ChatCompletionMessageParam[] {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  const system =
    typeof params.system === "string"
      ? params.system
      : (params.system ?? []).map((b) => b.text).join("\n");
  if (system) messages.push({ role: "system", content: system });
  for (const m of params.messages) {
    messages.push({ role: m.role, content: textOf(m.content) });
  }
  return messages;
}

function toAnthropicMessage(res: OpenAI.ChatCompletion, model: string): Anthropic.Message {
  const choice = res.choices[0];
  return {
    id: res.id,
    type: "message",
    role: "assistant",
    model,
    container: null,
    content: [{ type: "text", text: choice?.message?.content ?? "", citations: null }],
    stop_reason: choice?.finish_reason === "length" ? "max_tokens" : "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: res.usage?.prompt_tokens ?? 0,
      output_tokens: res.usage?.completion_tokens ?? 0,
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

/**
 * Anthropic-shaped client over an OpenAI-compatible API (OpenAI, Groq, Ollama),
 * so CRM callers keep using `client.messages.create`.
 */
function openAICompatibleClient(
  provider: OpenAICompatibleProvider,
  resolved: ResolvedAIProvider
): AIMessagesClient {
  const complete = async (
    client: OpenAI,
    params: Anthropic.MessageCreateParamsNonStreaming
  ): Promise<Anthropic.Message> => {
    const model = toOpenAICompatibleModel(params.model, provider);
    const res = await client.chat.completions.create({
      model,
      messages: toChatMessages(params),
      max_tokens: params.max_tokens,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    });
    return toAnthropicMessage(res, model);
  };

  return {
    messages: {
      create: async (params) => {
        if (provider !== "ollama") {
          const client = new OpenAI({
            apiKey: resolved.apiKey,
            ...(provider === "groq" ? { baseURL: "https://api.groq.com/openai/v1" } : {}),
          });
          return complete(client, params);
        }

        // SECURITY (SSRF): the Ollama base URL is tenant-configurable. Re-assert
        // at use time and pin the resolved addresses (no DNS rebinding).
        const baseURL = resolved.baseURL ?? "";
        let target;
        try {
          target = await assertSafeFetchTarget(baseURL);
        } catch {
          throw new Error("Configured Ollama base URL is not allowed");
        }
        const pinned = createPinnedFetch(target);
        try {
          const client = new OpenAI({ baseURL, apiKey: "ollama", fetch: pinned.fetch });
          return await complete(client, params);
        } finally {
          await pinned.close();
        }
      },
    },
  };
}

/** Maps a requested model to the org's custom model for its tier, unless it already is one. */
function toCustomModel(modelId: string, settings?: CustomModelSettings | null): string {
  if (!settings) return modelId;
  const configured = [settings.custom_model?.trim(), settings.custom_fast_model?.trim()];
  if (configured.includes(modelId)) return modelId;
  return convertModelForProvider(modelId, "custom", settings);
}

/**
 * Anthropic SDK client for the org's Anthropic-compatible endpoint. Only the
 * custom provider's own key is ever sent to the custom URL.
 */
function customClient(
  resolved: ResolvedAIProvider,
  settings?: CustomModelSettings | null
): AIMessagesClient {
  return {
    messages: {
      create: async (params) => {
        // Without a key the SDK would fall back to ANTHROPIC_API_KEY from env.
        if (!resolved.apiKey) throw new Error("Custom AI provider not configured");
        // SECURITY (SSRF): the base URL is tenant-configurable. Validate it at
        // use time and pin the resolved addresses for this call only.
        const pinned = await createCustomFetch(resolved.baseURL ?? "");
        try {
          // authToken: null so ANTHROPIC_AUTH_TOKEN from env is never sent to the tenant URL.
          const client = new Anthropic({
            apiKey: resolved.apiKey,
            authToken: null,
            baseURL: pinned.base,
            fetch: pinned.fetch,
            timeout: 60_000,
            maxRetries: 1,
          });
          return await client.messages.create({ ...params, model: toCustomModel(params.model, settings) });
        } finally {
          await pinned.close();
        }
      },
    },
  };
}

/**
 * Build the client for a resolved provider. `settings` lets the custom
 * provider map Claude model IDs to the org's configured models.
 */
export function createAIMessagesClient(
  resolved: ResolvedAIProvider,
  settings?: CustomModelSettings | null
): AIMessagesClient {
  switch (resolved.provider) {
    case "openrouter":
      return new Anthropic({
        apiKey: resolved.apiKey,
        baseURL: "https://openrouter.ai/api",
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://pulse-crm-weld.vercel.app",
          "X-Title": "Pulse CRM",
        },
      });
    case "anthropic":
      return new Anthropic({ apiKey: resolved.apiKey });
    case "custom":
      return customClient(resolved, settings);
    default:
      return openAICompatibleClient(resolved.provider, resolved);
  }
}

/**
 * Providers to try, in order: the resolved one first, then every other
 * provider that has a credential.
 */
function getProviderChain(settings: AISettings): ResolvedAIProvider[] {
  const primary = resolveAIProvider(settings, process.env);
  if (!primary) return [];
  const chain = [primary];
  for (const provider of AI_PROVIDER_ORDER) {
    if (provider === primary.provider) continue;
    const candidate = resolveAIProvider({ ...settings, ai_provider: provider }, process.env);
    if (candidate?.provider === provider) chain.push(candidate);
  }
  return chain;
}

export async function getAIClient(): Promise<AIClientResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Get user's org
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) throw new Error("No organization found");

  // Get AI settings (secret columns are only readable with the service role)
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("ai_settings")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .single();

  // Return settings with defaults if no settings row exists
  const resolvedSettings: AISettings = (settings as AISettings | null) || {
    id: "",
    organization_id: profile.organization_id,
    api_key: null,
    apify_api_key: null,
    openai_api_key: null,
    ai_provider: null,
    openrouter_api_key: null,
    custom_base_url: null,
    custom_api_key: null,
    custom_model: null,
    custom_fast_model: null,
    default_model: "sonnet",
    feature_lead_scoring: true,
    feature_icp_matching: true,
    feature_outreach: true,
    feature_proposals: true,
    feature_meetings: true,
    feature_analytics: true,
    feature_competitors: true,
    feature_objections: true,
    feature_chat: true,
    feature_marketing: true,
    autonomy_lead_scoring: "suggest",
    autonomy_icp_matching: "suggest",
    autonomy_outreach: "suggest",
    autonomy_proposals: "suggest",
    autonomy_meetings: "suggest",
    autonomy_analytics: "suggest",
    autonomy_competitors: "suggest",
    autonomy_objections: "suggest",
    tokens_used_today: 0,
    tokens_used_month: 0,
    daily_token_limit: 100000,
    monthly_token_limit: 2000000,
    last_token_reset_daily: new Date().toISOString(),
    last_token_reset_monthly: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const resolved = resolveAIProvider(resolvedSettings, process.env);
  if (!resolved) {
    throw new Error(
      "No AI API key configured. Add one in Settings > AI or set ANTHROPIC_API_KEY in environment."
    );
  }

  // Override the resolved provider so model resolution uses the correct map
  resolvedSettings.ai_provider = resolved.provider;

  const client = createAIMessagesClient(resolved, resolvedSettings);

  return {
    client,
    settings: resolvedSettings,
    orgId: profile.organization_id,
    userId: user.id,
  };
}

/**
 * Smart AI call with automatic provider fallback.
 *
 * Tries the resolved provider first. If it fails with a retriable error
 * (network, 429, 500+, auth), falls back to each other provider that has a
 * credential, in the order anthropic, openrouter, openai, groq, ollama, custom.
 * Each attempt uses only that provider's own credential and URL.
 *
 * Usage:
 *   const { client, settings, orgId, userId } = await getAIClient();
 *   const response = await callAIWithFallback({
 *     settings,
 *     createParams: (modelId) => ({ model: modelId, max_tokens: 1024, messages: [...] }),
 *     feature: "chat",
 *     orgId,
 *     userId,
 *   });
 */
export async function callAIWithFallback(params: {
  settings: AISettings;
  createParams: (modelId: string) => Anthropic.MessageCreateParamsNonStreaming;
  feature: AIFeature;
  orgId: string;
  userId: string;
  modelOverride?: string; // If provided, uses this model ID for primary attempt
}): Promise<{
  response: Anthropic.Message;
  model: string;
  provider: string;
  durationMs: number;
  fallbackUsed: boolean;
}> {
  const { settings, createParams, feature, orgId, userId, modelOverride } = params;
  const providerOrder = getProviderChain(settings);

  let lastError: Error | null = null;

  for (let i = 0; i < providerOrder.length; i++) {
    const provider = providerOrder[i].provider;
    const client = createAIMessagesClient(providerOrder[i], settings);
    // The custom provider always gets the org's configured model; the others
    // get the Claude/OpenRouter ID for the same tier.
    const modelId =
      modelOverride && i === 0 && provider !== "custom"
        ? modelOverride
        : convertModelForProvider(
            modelOverride || createParams("placeholder").model,
            provider,
            settings
          );

    // Build params with the correct model for this provider
    const callParams = createParams(modelId);
    callParams.model = modelId;

    const startTime = Date.now();

    try {
      const response = await client.messages.create(callParams);
      const durationMs = Date.now() - startTime;

      // Log successful usage
      await logTokenUsage({
        orgId,
        userId,
        feature,
        model: modelId,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        durationMs,
        success: true,
        metadata: {
          provider,
          fallbackUsed: i > 0,
          ...(i > 0 ? { primaryProvider: providerOrder[0].provider } : {}),
        },
      });

      return {
        response,
        model: modelId,
        provider,
        durationMs,
        fallbackUsed: i > 0,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      lastError = error instanceof Error ? error : new Error(String(error));

      // Log the failed attempt
      await logTokenUsage({
        orgId,
        userId,
        feature,
        model: modelId,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage: lastError.message.substring(0, 500),
        metadata: { provider, attemptIndex: i },
      });

      // Determine if we should try fallback
      if (isRetriableError(lastError) && i < providerOrder.length - 1) {
        console.warn(
          `[AI Fallback] ${provider} failed (${lastError.message.substring(0, 100)}), trying ${providerOrder[i + 1].provider}...`
        );
        continue;
      }

      // Non-retriable error or no more fallbacks — throw
      break;
    }
  }

  throw lastError || new Error("All AI providers failed");
}

/**
 * Determine if an error warrants trying a fallback provider.
 */
function isRetriableError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  // Network errors
  if (msg.includes("fetch failed") || msg.includes("econnrefused") || msg.includes("timeout")) {
    return true;
  }
  // Rate limiting
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) {
    return true;
  }
  // Server errors
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) {
    return true;
  }
  // Auth errors (might mean key is invalid/expired — try other provider)
  if (msg.includes("401") || msg.includes("403") || msg.includes("authentication") || msg.includes("unauthorized")) {
    return true;
  }
  // Model not found (wrong model ID for provider)
  if (msg.includes("404") || msg.includes("not found") || msg.includes("model")) {
    return true;
  }
  // OpenRouter specific
  if (msg.includes("overloaded") || msg.includes("capacity")) {
    return true;
  }
  return false;
}

export async function checkAIAccess(feature: AIFeature): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    const { settings } = await getAIClient();

    // Check feature toggle
    const featureKey = `feature_${feature}` as keyof AISettings;
    if (!settings[featureKey]) {
      return { allowed: false, reason: `AI ${feature} is disabled in settings` };
    }

    const limitReason = tokenLimitReason(settings);
    if (limitReason) {
      return { allowed: false, reason: limitReason };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: error instanceof Error ? error.message : "AI access check failed",
    };
  }
}

export function tokenLimitReason(
  settings: Pick<
    AISettings,
    | "daily_token_limit"
    | "monthly_token_limit"
    | "tokens_used_today"
    | "tokens_used_month"
    | "last_token_reset_daily"
    | "last_token_reset_monthly"
  >
): string | null {
  // Check daily token limit
  const today = new Date().toDateString();
  const lastResetDaily = new Date(settings.last_token_reset_daily).toDateString();
  const todayTokens = today === lastResetDaily ? settings.tokens_used_today : 0;

  if (settings.daily_token_limit > 0 && todayTokens >= settings.daily_token_limit) {
    return "Daily token limit reached";
  }

  // Check monthly token limit
  const thisMonth = new Date().getMonth();
  const lastResetMonth = new Date(settings.last_token_reset_monthly).getMonth();
  const monthTokens = thisMonth === lastResetMonth ? settings.tokens_used_month : 0;

  if (settings.monthly_token_limit > 0 && monthTokens >= settings.monthly_token_limit) {
    return "Monthly token limit reached";
  }

  return null;
}

export async function logTokenUsage(params: {
  orgId: string;
  userId: string;
  feature: AIFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createAdminClient();
    const totalTokens = params.inputTokens + params.outputTokens;

    // Insert usage log
    await supabase.from("ai_usage_log").insert({
      organization_id: params.orgId,
      user_id: params.userId,
      feature: params.feature,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: totalTokens,
      duration_ms: params.durationMs,
      success: params.success,
      error_message: params.errorMessage || null,
      metadata: JSON.parse(JSON.stringify(params.metadata || {})),
    });

    // Update token counters with daily/monthly reset logic
    const now = new Date();
    const { data: currentSettings } = await supabase
      .from("ai_settings")
      .select("tokens_used_today, tokens_used_month, last_token_reset_daily, last_token_reset_monthly")
      .eq("organization_id", params.orgId)
      .single();

    if (currentSettings) {
      const lastDailyReset = new Date(currentSettings.last_token_reset_daily);
      const lastMonthlyReset = new Date(currentSettings.last_token_reset_monthly);

      const isDifferentDay = now.toDateString() !== lastDailyReset.toDateString();
      const isDifferentMonth = now.getMonth() !== lastMonthlyReset.getMonth() || now.getFullYear() !== lastMonthlyReset.getFullYear();

      await supabase
        .from("ai_settings")
        .update({
          tokens_used_today: isDifferentDay ? totalTokens : currentSettings.tokens_used_today + totalTokens,
          tokens_used_month: isDifferentMonth ? totalTokens : currentSettings.tokens_used_month + totalTokens,
          last_token_reset_daily: isDifferentDay ? now.toISOString() : currentSettings.last_token_reset_daily,
          last_token_reset_monthly: isDifferentMonth ? now.toISOString() : currentSettings.last_token_reset_monthly,
        })
        .eq("organization_id", params.orgId);
    }
  } catch (error) {
    console.error("Failed to log token usage:", error);
  }
}
