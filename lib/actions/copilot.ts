"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { getAIClient, callAIWithFallback } from "@/lib/ai/client";
import { getModelForFeature } from "@/lib/ai/models";
import type { CopilotMemoryType } from "@/types/database";

// ── Conversations ──────────────────────────────────────────────────────────

export async function getConversations() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copilot_conversations")
    .select("*")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data || [] };
}

export async function deleteConversation(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("copilot_conversations")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Not found" };
  return { success: true };
}

// ── Memory ──────────────────────────────────────────────────────────────

const GUIDANCE_CAP_MESSAGE = "Guidance is limited to 10 active rules";
const GUIDANCE_MAX_LENGTH = 500;

// The DB trigger raises guidance_cap_exceeded when an org would have more than 10 active rules.
function memoryErrorMessage(message: string): string {
  return message.includes("guidance_cap_exceeded") ? GUIDANCE_CAP_MESSAGE : message;
}

export async function getMemoryItems() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copilot_memory")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data || [] };
}

export async function listMemoryByType(types: CopilotMemoryType[]) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copilot_memory")
    .select("*")
    .eq("organization_id", orgId)
    .in("type", types)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data || [] };
}

/** Creates a guidance rule, or edits the rule `id` when given. Max 10 active rules per org (DB trigger). */
export async function saveGuidance(content: string, id?: string) {
  const text = content.trim();
  if (!text) return { error: "Guidance cannot be empty", data: null };
  if (text.length > GUIDANCE_MAX_LENGTH) {
    return { error: `Guidance must be ${GUIDANCE_MAX_LENGTH} characters or fewer`, data: null };
  }
  const title = text.length > 60 ? `${text.slice(0, 57)}...` : text;

  const supabase = await createClient();
  const orgId = await getOrgId();

  if (id) {
    const { data, error } = await supabase
      .from("copilot_memory")
      .update({ title, content: text })
      .eq("id", id)
      .eq("organization_id", orgId)
      .eq("type", "guidance")
      .select()
      .maybeSingle();

    if (error) return { error: memoryErrorMessage(error.message), data: null };
    if (!data) return { error: "Not found", data: null };
    return { data };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", data: null };

  const { data, error } = await supabase
    .from("copilot_memory")
    .insert({
      organization_id: orgId,
      user_id: user.id,
      type: "guidance",
      title,
      content: text,
      source: "user",
    })
    .select()
    .single();

  if (error) return { error: memoryErrorMessage(error.message), data: null };
  return { data };
}

/** Read-only list of the org's ideal customer profiles, shown in the Memory view. */
export async function listIcpProfiles() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("icp_profiles")
    .select("id, name, description, is_primary")
    .eq("organization_id", orgId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data || [] };
}

export async function createMemoryItem(item: {
  type: CopilotMemoryType;
  title: string;
  content: string;
  source?: "user" | "copilot" | "scrape";
  source_url?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", data: null };

  const { data, error } = await supabase
    .from("copilot_memory")
    .insert({
      organization_id: orgId,
      user_id: user.id,
      ...item,
    })
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function updateMemoryItem(id: string, updates: {
  title?: string;
  content?: string;
  type?: CopilotMemoryType;
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("copilot_memory")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id");

  if (error) return { error: memoryErrorMessage(error.message) };
  if (!data?.length) return { error: "Not found" };
  return { success: true };
}

export async function deleteMemoryItem(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("copilot_memory")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Not found" };
  return { success: true };
}

// ── Website Scraping for Memory ──────────────────────────────────────────

type MemoryType = "business_details" | "product_info" | "target_audience" | "brand_voice" | "custom";

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function scrapeWebsiteForMemory(url: string): Promise<{
  data?: Array<{ type: MemoryType; title: string; content: string }>;
  siteName?: string;
  error?: string;
}> {
  await getOrgId();
  try {
    // Validate & normalize URL, then guard against SSRF (private IPs, non-http(s) schemes)
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = "https://" + normalizedUrl;
    }
    const { assertSafeFetchTarget } = await import("@/lib/security/fetch-target");
    let target;
    try {
      target = await assertSafeFetchTarget(normalizedUrl);
    } catch {
      return { error: "Invalid URL. Only public http(s) URLs are allowed." };
    }

    // Fetch with timeout, pinned to the DNS-checked addresses (no redirects)
    const { fetchPinnedText } = await import("@/lib/security/safe-fetch");
    const headers = {
      "User-Agent": "Mozilla/5.0 (compatible; PulseCRM/1.0; +https://pulse-crm.com)",
      "Accept": "text/html,application/xhtml+xml",
    };

    let response: { status: number; ok: boolean; text: string };
    try {
      response = await fetchPinnedText(target, { timeoutMs: 10000, headers });
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        return { error: "Website took too long to respond. Please try again." };
      }
      return { error: "Could not reach the website. Please check the URL and try again." };
    }

    if (!response.ok) {
      return { error: `Website returned an error (${response.status}). Please check the URL.` };
    }

    const html = response.text;
    const text = htmlToText(html);

    if (text.length < 50) {
      return { error: "Could not extract enough content from this website. Try a different page." };
    }

    // Truncate for AI context
    const truncatedText = text.slice(0, 15000);

    // Get AI client with smart fallback
    const { settings, orgId, userId } = await getAIClient();
    const model = getModelForFeature("memory_scrape", undefined, settings.ai_provider);

    const prompt = `Analyze this website content and extract business information. Return a JSON array of items, each with "type", "title", and "content" fields.

Types to extract (use as many as relevant):
- "business_details": Company name, description, mission, founding info, location, team size
- "product_info": Products or services offered, features, pricing model
- "target_audience": Who the company serves, ideal customers, industries
- "brand_voice": Communication style, tone, key messaging themes, taglines
- "custom": Any other important business context (partnerships, awards, tech stack, etc.)

Rules:
- Each item should have a descriptive title (3-8 words)
- Content should be 1-3 concise sentences capturing the key info
- Only include items you're confident about from the content
- Return ONLY the JSON array, no other text

Website content:
${truncatedText}`;

    const { response: aiResponse } = await callAIWithFallback({
      settings,
      feature: "memory_scrape",
      orgId,
      userId,
      modelOverride: model,
      createParams: (modelId) => ({
        model: modelId,
        max_tokens: 2000,
        messages: [{ role: "user" as const, content: prompt }],
      }),
    });

    // Parse AI response
    const responseText = aiResponse.content[0]?.type === "text" ? aiResponse.content[0].text : "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { error: "AI could not extract structured data from this website. Try a different page." };
    }

    let items: Array<{ type: MemoryType; title: string; content: string }>;
    try {
      items = JSON.parse(jsonMatch[0]);
    } catch {
      return { error: "Failed to parse AI response. Please try again." };
    }

    // Validate items
    const validTypes: MemoryType[] = ["business_details", "product_info", "target_audience", "brand_voice", "custom"];
    items = items.filter(
      (item) => validTypes.includes(item.type) && item.title && item.content
    );

    if (items.length === 0) {
      return { error: "No business information could be extracted from this website." };
    }

    // Try to extract site name from title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const siteName = titleMatch ? titleMatch[1].split(/[|\-–—]/)[0].trim() : new URL(normalizedUrl).hostname;

    return { data: items, siteName };
  } catch (err) {
    console.error("scrapeWebsiteForMemory error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

// ── Tasks ──────────────────────────────────────────────────────────────

export async function getCopilotTasks() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copilot_tasks")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data || [] };
}

export async function createCopilotTask(task: {
  title: string;
  prompt: string;
  schedule: "daily" | "weekly" | "monthly" | "custom";
  cron_expression?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", data: null };

  const { data, error } = await supabase
    .from("copilot_tasks")
    .insert({
      organization_id: orgId,
      user_id: user.id,
      ...task,
    })
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function updateCopilotTask(id: string, updates: {
  title?: string;
  prompt?: string;
  schedule?: "daily" | "weekly" | "monthly" | "custom";
  cron_expression?: string;
  is_active?: boolean;
  last_run_at?: string;
  next_run_at?: string;
  run_count?: number;
  last_result?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("copilot_tasks")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Not found" };
  return { success: true };
}

export async function deleteCopilotTask(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("copilot_tasks")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Not found" };
  return { success: true };
}
