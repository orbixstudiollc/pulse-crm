"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";

// Visible notifications are org-wide (user_id IS NULL) or addressed to the caller.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

async function context() {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, orgId, mine: `user_id.is.null,user_id.eq.${user.id}` };
}

export async function listNotifications(limit: number = DEFAULT_LIMIT) {
  const { supabase, orgId, mine } = await context();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("organization_id", orgId)
    .or(mine)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT));
  if (error) throw new Error(`listNotifications failed: ${error.message}`);
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<{ success: true } | { error: string }> {
  const { supabase, orgId, mine } = await context();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId)
    .or(mine)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Not found" };
  return { success: true };
}

export async function markAllRead(): Promise<{ success: true } | { error: string }> {
  const { supabase, orgId, mine } = await context();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .or(mine)
    .is("read_at", null);
  if (error) return { error: error.message };
  return { success: true };
}

export async function unreadCount(): Promise<number> {
  const { supabase, orgId, mine } = await context();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .or(mine)
    .is("read_at", null);
  if (error) throw new Error(`unreadCount failed: ${error.message}`);
  return count ?? 0;
}
