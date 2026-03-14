"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";

// ── Types ──────────────────────────────────────────────────────────────────

interface ThreadFilters {
  accountId?: string;
  isRead?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// ── Get Threads ────────────────────────────────────────────────────────────

export async function getEmailThreads(filters: ThreadFilters = {}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("email_threads")
    .select(`
      *,
      email_accounts!inner (
        id,
        email_address,
        provider,
        display_name
      ),
      leads (
        id,
        name,
        email,
        company
      ),
      contacts (
        id,
        name,
        email
      )
    `)
    .eq("organization_id", orgId)
    .order("last_message_at", { ascending: false });

  if (filters.accountId) {
    query = query.eq("email_account_id", filters.accountId);
  }
  if (filters.isRead !== undefined) {
    query = query.eq("is_read", filters.isRead);
  }
  if (filters.isStarred) {
    query = query.eq("is_starred", true);
  }
  if (filters.isArchived !== undefined) {
    query = query.eq("is_archived", filters.isArchived);
  } else {
    // Default: hide archived
    query = query.eq("is_archived", false);
  }
  if (filters.search) {
    query = query.ilike("subject", `%${filters.search}%`);
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) return { error: error.message };
  return { data: data ?? [] };
}

// ── Get Thread Messages ────────────────────────────────────────────────────

export async function getThreadMessages(threadId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Verify thread belongs to org
  const { data: thread } = await supabase
    .from("email_threads")
    .select("id")
    .eq("id", threadId)
    .eq("organization_id", orgId)
    .single();

  if (!thread) return { error: "Thread not found" };

  const { data: messages, error } = await supabase
    .from("email_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };

  // Auto-mark thread as read
  await supabase
    .from("email_threads")
    .update({ is_read: true })
    .eq("id", threadId);

  return { data: messages ?? [] };
}

// ── Thread Actions ─────────────────────────────────────────────────────────

export async function markThreadRead(threadId: string, isRead: boolean) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  await supabase
    .from("email_threads")
    .update({ is_read: isRead })
    .eq("id", threadId)
    .eq("organization_id", orgId);

  revalidatePath("/dashboard/inbox");
  return { success: true };
}

export async function toggleThreadStar(threadId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: thread } = await supabase
    .from("email_threads")
    .select("is_starred")
    .eq("id", threadId)
    .eq("organization_id", orgId)
    .single();

  if (!thread) return { error: "Thread not found" };

  await supabase
    .from("email_threads")
    .update({ is_starred: !thread.is_starred })
    .eq("id", threadId);

  revalidatePath("/dashboard/inbox");
  return { success: true, isStarred: !thread.is_starred };
}

export async function archiveThread(threadId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  await supabase
    .from("email_threads")
    .update({ is_archived: true })
    .eq("id", threadId)
    .eq("organization_id", orgId);

  revalidatePath("/dashboard/inbox");
  return { success: true };
}

export async function unarchiveThread(threadId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  await supabase
    .from("email_threads")
    .update({ is_archived: false })
    .eq("id", threadId)
    .eq("organization_id", orgId);

  revalidatePath("/dashboard/inbox");
  return { success: true };
}

// ── Get Email Accounts (for compose account picker) ────────────────────────

export async function getActiveEmailAccounts() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, email_address, display_name, provider, is_default")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("is_default", { ascending: false });

  if (error) return { error: error.message };
  return { data: data ?? [] };
}

// ── Get Inbox Stats ────────────────────────────────────────────────────────

export async function getInboxStats() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { count: unreadCount } = await supabase
    .from("email_threads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_read", false)
    .eq("is_archived", false);

  const { count: totalCount } = await supabase
    .from("email_threads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_archived", false);

  return {
    unread: unreadCount || 0,
    total: totalCount || 0,
  };
}
