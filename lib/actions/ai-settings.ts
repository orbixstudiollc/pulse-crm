"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { AISettings, PublicAISettings, AIUsageStats, AIUsageDailyPoint, AIUsageLogEntry } from "@/lib/ai/types";
import { toPublicAISettings, omitBlankAISecrets } from "@/lib/ai/public-settings";

const AI_SETTINGS_SELECT =
  "id, organization_id, api_key, apify_api_key, ai_provider, openrouter_api_key, openrouter_oauth_token, " +
  "openrouter_code_verifier, openrouter_expires_at, groq_api_key, ollama_base_url, obsidian_vault_path, " +
  "obsidian_sync_enabled, openai_api_key, default_model, feature_lead_scoring, feature_icp_matching, " +
  "feature_outreach, feature_proposals, feature_meetings, feature_analytics, feature_competitors, " +
  "feature_objections, feature_chat, feature_marketing, autonomy_lead_scoring, autonomy_icp_matching, " +
  "autonomy_outreach, autonomy_proposals, autonomy_meetings, autonomy_analytics, autonomy_competitors, " +
  "autonomy_objections, tokens_used_today, tokens_used_month, daily_token_limit, monthly_token_limit, " +
  "last_token_reset_daily, last_token_reset_monthly, parallel_enrichment_limit, created_at, updated_at";

export async function getAISettings(): Promise<PublicAISettings | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) return null;

  const { data, error } = await supabase
    .from("ai_settings")
    .select(AI_SETTINGS_SELECT)
    .eq("organization_id", profile.organization_id)
    .single();

  // If no settings exist yet, create defaults
  if (error?.code === "PGRST116" || !data) {
    const { data: newSettings, error: insertError } = await supabase
      .from("ai_settings")
      .insert({
        organization_id: profile.organization_id,
      })
      .select(AI_SETTINGS_SELECT)
      .single();

    if (insertError) {
      console.error("Failed to create AI settings:", insertError);
      return null;
    }

    return toPublicAISettings(newSettings as unknown as AISettings);
  }

  if (error) {
    console.error("Failed to fetch AI settings:", error);
    return null;
  }

  return toPublicAISettings(data as unknown as AISettings);
}

export async function updateAISettings(
  updates: Partial<Omit<AISettings, "id" | "organization_id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) return { success: false, error: "No organization" };

  const clean = omitBlankAISecrets(updates);

  const { error } = await supabase
    .from("ai_settings")
    .update(clean)
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Failed to update AI settings:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function getAIUsageStats(
  days: number = 30
): Promise<AIUsageStats[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("ai_usage_log")
    .select("feature, total_tokens, success")
    .eq("organization_id", profile.organization_id)
    .gte("created_at", since.toISOString());

  if (!data || data.length === 0) return [];

  // Aggregate by feature
  const statsMap: Record<string, { total_requests: number; total_tokens: number; successes: number }> = {};

  for (const row of data) {
    if (!statsMap[row.feature]) {
      statsMap[row.feature] = { total_requests: 0, total_tokens: 0, successes: 0 };
    }
    statsMap[row.feature].total_requests++;
    statsMap[row.feature].total_tokens += row.total_tokens;
    if (row.success) statsMap[row.feature].successes++;
  }

  return Object.entries(statsMap).map(([feature, stats]) => ({
    feature,
    total_requests: stats.total_requests,
    total_tokens: stats.total_tokens,
    avg_tokens: Math.round(stats.total_tokens / stats.total_requests),
    success_rate: Math.round((stats.successes / stats.total_requests) * 100),
  }));
}

export async function getAIUsageDailyChart(
  days: number = 14
): Promise<AIUsageDailyPoint[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("ai_usage_log")
    .select("total_tokens, created_at")
    .eq("organization_id", profile.organization_id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) return [];

  // Aggregate by day
  const dayMap: Record<string, { tokens: number; requests: number }> = {};

  // Pre-fill all days
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().split("T")[0];
    dayMap[key] = { tokens: 0, requests: 0 };
  }

  for (const row of data) {
    const key = new Date(row.created_at).toISOString().split("T")[0];
    if (!dayMap[key]) dayMap[key] = { tokens: 0, requests: 0 };
    dayMap[key].tokens += row.total_tokens;
    dayMap[key].requests++;
  }

  return Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({
      date,
      tokens: stats.tokens,
      requests: stats.requests,
    }));
}

export async function getAIUsageLog(
  limit: number = 20
): Promise<AIUsageLogEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) return [];

  const { data } = await supabase
    .from("ai_usage_log")
    .select("id, feature, model, total_tokens, duration_ms, success, error_message, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []) as AIUsageLogEntry[];
}
