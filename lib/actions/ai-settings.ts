"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { AISettings, AIUsageStats, AIUsageDailyPoint, AIUsageLogEntry } from "@/lib/ai/types";

export async function getAISettings(): Promise<AISettings | null> {
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
    .select("*")
    .eq("organization_id", profile.organization_id)
    .single();

  // If no settings exist yet, create defaults
  if (error?.code === "PGRST116" || !data) {
    const { data: newSettings, error: insertError } = await supabase
      .from("ai_settings")
      .insert({
        organization_id: profile.organization_id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create AI settings:", insertError);
      return null;
    }

    return newSettings as AISettings;
  }

  if (error) {
    console.error("Failed to fetch AI settings:", error);
    return null;
  }

  return data as AISettings;
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

  const { error } = await supabase
    .from("ai_settings")
    .update(updates)
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
