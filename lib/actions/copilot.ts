"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";

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
