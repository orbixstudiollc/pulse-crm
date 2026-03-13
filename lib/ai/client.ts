import Anthropic from "@anthropic-ai/sdk";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AIFeature, AISettings } from "./types";

interface AIClientResult {
  client: Anthropic;
  settings: AISettings;
  orgId: string;
  userId: string;
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

  // Determine provider and resolve API key
  const provider = settings?.ai_provider || "anthropic";
  let apiKey: string;
  let clientOptions: ConstructorParameters<typeof Anthropic>[0];

  if (provider === "openrouter") {
    apiKey = settings?.openrouter_api_key || "";
    if (!apiKey) {
      throw new Error(
        "No OpenRouter API key configured. Add one in Settings > AI."
      );
    }
    clientOptions = {
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://pulse-crm-rosy.vercel.app",
        "X-Title": "Pulse CRM",
      },
    };
  } else {
    apiKey = settings?.api_key || process.env.ANTHROPIC_API_KEY || "";
    if (!apiKey) {
      throw new Error(
        "No AI API key configured. Add one in Settings > AI or set ANTHROPIC_API_KEY in environment."
      );
    }
    clientOptions = { apiKey };
  }

  const client = new Anthropic(clientOptions);

  // Return settings with defaults if no settings row exists
  const resolvedSettings: AISettings = settings || {
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

  return {
    client,
    settings: resolvedSettings,
    orgId: profile.organization_id,
    userId: user.id,
  };
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
