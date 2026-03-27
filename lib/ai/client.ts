import Anthropic from "@anthropic-ai/sdk";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AIFeature, AISettings } from "./types";
import { convertModelForProvider } from "./models";

interface AIClientResult {
  client: Anthropic;
  settings: AISettings;
  orgId: string;
  userId: string;
}

// Provider configuration for building Anthropic SDK clients
interface ProviderConfig {
  provider: string;
  apiKey: string;
  clientOptions: ConstructorParameters<typeof Anthropic>[0];
}

/**
 * Build provider config for a given provider type and settings.
 * Returns null if the provider's API key is not configured.
 */
function buildProviderConfig(
  provider: string,
  settings: AISettings | null
): ProviderConfig | null {
  if (provider === "openrouter") {
    const apiKey = settings?.openrouter_api_key || "";
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      clientOptions: {
        apiKey,
        baseURL: "https://openrouter.ai/api",
        defaultHeaders: {
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL ||
            "https://pulse-crm-rosy.vercel.app",
          "X-Title": "Pulse CRM",
        },
      },
    };
  }

  // Default: direct Anthropic
  const apiKey = settings?.api_key || process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) return null;
  return {
    provider: "anthropic",
    apiKey,
    clientOptions: { apiKey },
  };
}

/**
 * Determine the fallback provider order.
 * Primary = user's configured provider, fallback = the other one.
 */
function getProviderOrder(settings: AISettings | null): string[] {
  const primary = settings?.ai_provider || "anthropic";
  if (primary === "openrouter") return ["openrouter", "anthropic"];
  return ["anthropic", "openrouter"];
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

  // Get AI settings
  const { data: settings } = await supabase
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
    ai_provider: "anthropic",
    openrouter_api_key: null,
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

  // Build client for primary provider
  const providerOrder = getProviderOrder(resolvedSettings);
  let config: ProviderConfig | null = null;

  for (const p of providerOrder) {
    config = buildProviderConfig(p, resolvedSettings);
    if (config) break;
  }

  if (!config) {
    throw new Error(
      "No AI API key configured. Add one in Settings > AI or set ANTHROPIC_API_KEY in environment."
    );
  }

  // Override the resolved provider so model resolution uses the correct map
  resolvedSettings.ai_provider = config.provider;

  const client = new Anthropic(config.clientOptions);

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
 * Tries the primary provider first. If it fails with a retriable error
 * (network, 429, 500+, auth), automatically falls back to the other provider
 * if its API key is configured. This means:
 *   - OpenRouter primary → falls back to direct Anthropic (if ANTHROPIC_API_KEY set)
 *   - Anthropic primary → falls back to OpenRouter (if openrouter_api_key set)
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
  const providerOrder = getProviderOrder(settings);

  let lastError: Error | null = null;

  for (let i = 0; i < providerOrder.length; i++) {
    const provider = providerOrder[i];
    const config = buildProviderConfig(provider, settings);

    if (!config) continue; // Skip if no API key for this provider

    const client = new Anthropic(config.clientOptions);
    const modelId = modelOverride
      ? (i === 0 ? modelOverride : convertModelForProvider(modelOverride, provider))
      : convertModelForProvider(
          createParams("placeholder").model,
          provider
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
          ...(i > 0 ? { primaryProvider: providerOrder[0] } : {}),
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
          `[AI Fallback] ${provider} failed (${lastError.message.substring(0, 100)}), trying ${providerOrder[i + 1]}...`
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

    // Check daily token limit
    const today = new Date().toDateString();
    const lastResetDaily = new Date(settings.last_token_reset_daily).toDateString();
    const todayTokens = today === lastResetDaily ? settings.tokens_used_today : 0;

    if (settings.daily_token_limit > 0 && todayTokens >= settings.daily_token_limit) {
      return { allowed: false, reason: "Daily token limit reached" };
    }

    // Check monthly token limit
    const thisMonth = new Date().getMonth();
    const lastResetMonth = new Date(settings.last_token_reset_monthly).getMonth();
    const monthTokens = thisMonth === lastResetMonth ? settings.tokens_used_month : 0;

    if (settings.monthly_token_limit > 0 && monthTokens >= settings.monthly_token_limit) {
      return { allowed: false, reason: "Monthly token limit reached" };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: error instanceof Error ? error.message : "AI access check failed",
    };
  }
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
