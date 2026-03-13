"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { getAIClient, callAIWithFallback } from "@/lib/ai/client";
import { getModelForFeature } from "@/lib/ai/models";

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

export async function createConversation(title?: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", data: null };

  const { data, error } = await supabase
    .from("copilot_conversations")
    .insert({ organization_id: orgId, user_id: user.id, title: title || "New Chat" })
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function updateConversation(id: string, updates: { title?: string; is_pinned?: boolean; summary?: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("copilot_conversations")
    .update(updates)
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteConversation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("copilot_conversations")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}

// ── Messages ──────────────────────────────────────────────────────────────

export async function getMessages(conversationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("copilot_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data || [] };
}

export async function saveMessage(conversationId: string, role: "user" | "assistant", content: string, extras?: { tool_calls?: unknown; tool_results?: unknown; tokens_used?: number }) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copilot_messages")
    .insert({
      conversation_id: conversationId,
      organization_id: orgId,
      role,
      content,
      tool_calls: extras?.tool_calls as never,
      tool_results: extras?.tool_results as never,
      tokens_used: extras?.tokens_used || 0,
    })
    .select()
    .single();

  // Also update conversation's updated_at
  await supabase
    .from("copilot_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) return { error: error.message, data: null };
  return { data };
}

// ── Memory ──────────────────────────────────────────────────────────────

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

export async function createMemoryItem(item: {
  type: "business_details" | "product_info" | "target_audience" | "brand_voice" | "custom";
  title: string;
  content: string;
  source?: "manual" | "website" | "file";
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
  type?: "business_details" | "product_info" | "target_audience" | "brand_voice" | "custom";
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("copilot_memory")
    .update(updates)
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteMemoryItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("copilot_memory")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
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
  try {
    // Validate & normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = "https://" + normalizedUrl;
    }
    try {
      new URL(normalizedUrl);
    } catch {
      return { error: "Invalid URL format. Please enter a valid website address." };
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(normalizedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PulseCRM/1.0; +https://pulse-crm.com)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        return { error: "Website took too long to respond. Please try again." };
      }
      return { error: "Could not reach the website. Please check the URL and try again." };
    }
    clearTimeout(timeout);

    if (!response.ok) {
      return { error: `Website returned an error (${response.status}). Please check the URL.` };
    }

    const html = await response.text();
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
  const { error } = await supabase
    .from("copilot_tasks")
    .update(updates)
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteCopilotTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("copilot_tasks")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}
