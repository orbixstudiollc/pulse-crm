"use server";

import type { UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { getOrCreateConversation, loadUiMessages } from "@/lib/ai/history";

// Reads run on the caller's RLS client; ownership is also checked explicitly
// (organization_id AND user_id) by getOrCreateConversation.

async function currentUserId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function listConversationMessages(conversationId: string): Promise<UIMessage[]> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const userId = await currentUserId(supabase);

  const conversation = await getOrCreateConversation(supabase, { orgId, userId, conversationId });
  if ("error" in conversation) return [];
  return loadUiMessages(supabase, conversation.id, orgId);
}

export async function listConversations() {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const userId = await currentUserId(supabase);

  const { data, error } = await supabase
    .from("copilot_conversations")
    .select("id, title, summary, is_pinned, page_key, created_at, updated_at")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listConversations failed: ${error.message}`);
  return data ?? [];
}

export async function getPageConversation(pageKey: string): Promise<{ id: string; messages: UIMessage[] }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const userId = await currentUserId(supabase);

  const conversation = await getOrCreateConversation(supabase, { orgId, userId, pageKey });
  if ("error" in conversation) throw new Error("Conversation not found");
  const messages = await loadUiMessages(supabase, conversation.id, orgId);
  return { id: conversation.id, messages };
}
