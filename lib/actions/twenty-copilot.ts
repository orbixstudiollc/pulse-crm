"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { requireTwentyConnection } from "@/lib/twenty/connections";

export async function listTwentyMemories(connectionId?: string) {
  const db = await createClient();
  const orgId = await getOrgId();
  const { data: { user } } = await db.auth.getUser();
  if (!user || user.is_anonymous) throw new Error("Twenty requires an owner/admin account");
  const connection = await requireTwentyConnection({ db: createAdminClient(), orgId, userId: user.id, connectionId });
  const { data, error } = await db.from("copilot_memory").select("id,title,content,is_active")
    .eq("organization_id", orgId).eq("crm_source", "twenty").eq("connection_id", connection.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load Twenty memory");
  return data ?? [];
}
