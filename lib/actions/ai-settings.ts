"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { AISettings, PublicAISettings, AIUsageStats, AIUsageDailyPoint, AIUsageLogEntry } from "@/lib/ai/types";
import { toPublicAISettings, omitBlankAISecrets, pickWritableAISettings } from "@/lib/ai/public-settings";
import { requireRole } from "./helpers";
import { assertSafeFetchTarget } from "@/lib/security/fetch-target";
import {
  createCustomFetch,
  normalizeCustomBaseUrl,
  openCustomApiKey,
  sealCustomApiKey,
} from "@/lib/ai/custom-provider";

const CUSTOM_MODELS_TIMEOUT_MS = 10_000;
const CUSTOM_MODELS_MAX_BYTES = 1_048_576;
const CUSTOM_URL_NOT_ALLOWED = "Custom AI base URL is not allowed (it must be a public https host)";
const LIST_MODELS_MAX_CALLS = 10;
const LIST_MODELS_WINDOW_MS = 60_000;

// Per-instance (best-effort) window of listCustomModels calls per org.
const listModelsCalls = new Map<string, number[]>();

/** Records a listCustomModels call; false when the org is over its limit. */
function allowListModels(orgId: string): boolean {
  const now = Date.now();
  const recent = (listModelsCalls.get(orgId) ?? []).filter((t) => t > now - LIST_MODELS_WINDOW_MS);
  if (recent.length >= LIST_MODELS_MAX_CALLS) {
    listModelsCalls.set(orgId, recent);
    return false;
  }
  listModelsCalls.set(orgId, [...recent, now]);
  return true;
}

/** The normalized form of a stored base URL, or null when missing or unusable. */
function normalizedOrNull(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return normalizeCustomBaseUrl(url);
  } catch {
    return null;
  }
}

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

  // Secret columns are only readable with the service role; they are stripped before returning.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_settings")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .single();

  // If no settings exist yet, create defaults
  if (error?.code === "PGRST116" || !data) {
    const { data: newSettings, error: insertError } = await admin
      .from("ai_settings")
      .insert({
        organization_id: profile.organization_id,
      })
      .select("*")
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
  let orgId: string;
  try {
    ({ orgId } = await requireRole("admin", "owner"));
  } catch (err) {
    unstable_rethrow(err);
    return { success: false, error: err instanceof Error ? err.message : "Forbidden: admin role required" };
  }

  const clean = omitBlankAISecrets(pickWritableAISettings(updates));
  if (Object.keys(clean).length === 0) return { success: false, error: "No writable fields" };

  // SECURITY (SSRF): the Ollama base URL is fetched server-side; reject hosts
  // that are private or resolve to private addresses before storing it.
  // (ollama_base_url is an allowlisted column missing from the AISettings type.)
  const ollamaBaseUrl = (clean as Record<string, unknown>).ollama_base_url;
  if (typeof ollamaBaseUrl === "string" && ollamaBaseUrl.trim()) {
    try {
      await assertSafeFetchTarget(ollamaBaseUrl);
    } catch {
      return { success: false, error: "Ollama base URL is not allowed" };
    }
  }

  const prepared = await prepareCustomProviderFields(clean, orgId);
  if ("error" in prepared) return { success: false, error: prepared.error };

  const { error } = await createAdminClient()
    .from("ai_settings")
    .update(prepared.updates)
    .eq("organization_id", orgId);

  if (error) {
    console.error("Failed to update AI settings:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

/**
 * Returns a copy of `clean` with the custom provider fields prepared: the base
 * URL normalized and SSRF-checked (blank clears it), the API key sealed for
 * this org and URL. A saved key is only kept while the URL is unchanged.
 * Returns a user-readable error when a field is not acceptable.
 */
async function prepareCustomProviderFields<T extends Record<string, unknown>>(
  clean: T,
  orgId: string
): Promise<{ updates: T } | { error: string }> {
  const updates: Record<string, unknown> = { ...clean };
  const baseUrl = clean.custom_base_url;
  // Blank keys were already dropped by omitBlankAISecrets (the saved key is kept).
  const apiKey = typeof clean.custom_api_key === "string" ? clean.custom_api_key.trim() : "";
  if (typeof baseUrl !== "string" && !apiKey) return { updates: clean };

  const { data: saved, error } = await createAdminClient()
    .from("ai_settings")
    .select("custom_base_url")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load the saved custom AI base URL:", error);
    return { error: "Could not load the saved AI settings" };
  }
  const savedBase = normalizedOrNull(saved?.custom_base_url);

  let base = savedBase;
  if (typeof baseUrl === "string" && baseUrl.trim()) {
    try {
      base = normalizeCustomBaseUrl(baseUrl);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Base URL is not valid" };
    }
    // SECURITY (SSRF): the custom base URL is fetched server-side.
    try {
      await assertSafeFetchTarget(base);
    } catch {
      return { error: CUSTOM_URL_NOT_ALLOWED };
    }
    updates.custom_base_url = base;
  } else if (typeof baseUrl === "string") {
    base = null;
    updates.custom_base_url = null;
  }

  if (apiKey) {
    if (!base) return { error: "Enter a base URL first" };
    try {
      updates.custom_api_key = sealCustomApiKey(apiKey, orgId, base);
    } catch {
      return { error: "The API key could not be stored securely (encryption is not configured)" };
    }
  } else if (base && base !== savedBase) {
    // The saved key is sealed for the saved URL and is never sent elsewhere.
    return { error: "Re-enter the API key when changing the base URL" };
  }

  return { updates: updates as T };
}

/** Reads a response body as text; null when it exceeds maxBytes. */
async function readCappedText(res: Response, maxBytes: number): Promise<string | null> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

async function fetchCustomModelIds(
  base: string,
  apiKey: string
): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  let pinned: Awaited<ReturnType<typeof createCustomFetch>>;
  try {
    pinned = await createCustomFetch(base);
  } catch {
    return { ok: false, error: CUSTOM_URL_NOT_ALLOWED };
  }

  try {
    const res = await pinned.fetch(`${pinned.base}/v1/models`, {
      method: "GET",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", accept: "application/json" },
      signal: AbortSignal.timeout(CUSTOM_MODELS_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "The endpoint rejected the API key" };
    }
    if (!res.ok) return { ok: false, error: `The endpoint returned HTTP ${res.status}` };

    const text = await readCappedText(res, CUSTOM_MODELS_MAX_BYTES);
    if (text === null) return { ok: false, error: "The model list is too large" };
    const body = JSON.parse(text) as { data?: unknown };
    const models = (Array.isArray(body?.data) ? body.data : [])
      .map((m: { id?: unknown } | null) => m?.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (models.length === 0) return { ok: false, error: "The endpoint returned no models" };
    return { ok: true, models };
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { ok: false, error: "The endpoint did not respond within 10 seconds" };
    }
    if (err instanceof SyntaxError) return { ok: false, error: "The endpoint did not return a model list" };
    return { ok: false, error: "Could not reach the endpoint" };
  } finally {
    await pinned.close();
  }
}

/**
 * Lists the model IDs offered by a custom Anthropic-compatible endpoint
 * (GET {base}/v1/models). Omitted arguments fall back to the saved settings;
 * the saved key is only used for the saved URL. Admin/owner only, rate
 * limited per org. Error messages never include the API key.
 */
export async function listCustomModels(input?: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  let orgId: string;
  try {
    ({ orgId } = await requireRole("admin", "owner"));
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, error: err instanceof Error ? err.message : "Forbidden: admin role required" };
  }
  if (!allowListModels(orgId)) {
    return { ok: false, error: "Too many model list requests. Try again in a minute." };
  }

  const typedUrl = input?.baseUrl?.trim() || null;
  const typedKey = input?.apiKey?.trim() || null;
  let saved: { custom_base_url: string | null; custom_api_key: string | null } | null = null;
  if (!typedUrl || !typedKey) {
    // Secret columns are only readable with the service role.
    const { data } = await createAdminClient()
      .from("ai_settings")
      .select("custom_base_url, custom_api_key")
      .eq("organization_id", orgId)
      .maybeSingle();
    saved = data;
  }
  const baseUrl = typedUrl ?? saved?.custom_base_url ?? null;
  if (!baseUrl) return { ok: false, error: "Enter a base URL first" };

  let base: string;
  try {
    base = normalizeCustomBaseUrl(baseUrl);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Base URL is not valid" };
  }

  let apiKey = typedKey;
  if (!apiKey) {
    // SECURITY: the saved key may only be sent to the URL it was saved for.
    const savedBase = normalizedOrNull(saved?.custom_base_url);
    if (savedBase !== base) return { ok: false, error: "Enter the API key for this URL" };
    apiKey = openCustomApiKey(saved?.custom_api_key, orgId, savedBase);
  }
  if (!apiKey) return { ok: false, error: "Enter an API key first" };

  return fetchCustomModelIds(base, apiKey);
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
