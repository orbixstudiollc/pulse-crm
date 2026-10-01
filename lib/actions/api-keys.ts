"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "./helpers";
import { generateApiKey, type ApiKeyScope } from "@/lib/mcp/api-keys";
import { isUuid } from "@/lib/security";
import { unstable_rethrow } from "next/navigation";

// API keys for the MCP server. Admin/owner only; writes go through the
// service role because migration 036 grants authenticated users SELECT only.

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scope: ApiKeyScope;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export async function getApiKeys(): Promise<{ data: ApiKeyRow[]; error?: string }> {
  try {
    const { orgId } = await requireRole();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("api_keys")
      .select("id, name, key_prefix, scope, last_used_at, revoked_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as ApiKeyRow[] };
  } catch (e) {
    unstable_rethrow(e);
    return { data: [], error: e instanceof Error ? e.message : "Failed to load API keys" };
  }
}

/** Creates a key and returns the plaintext once; it cannot be retrieved again. */
export async function createApiKey(input: {
  name: string;
  scope: ApiKeyScope;
}): Promise<{ key?: string; error?: string }> {
  const name = input.name?.trim().slice(0, 80);
  if (!name) return { error: "Give the key a name" };
  const scope: ApiKeyScope = input.scope === "write" ? "write" : "read";

  try {
    const { user, orgId } = await requireRole();
    const { key, prefix, hash } = generateApiKey();
    const admin = createAdminClient();
    const { error } = await admin.from("api_keys").insert({
      organization_id: orgId,
      created_by: user.id,
      name,
      scope,
      key_prefix: prefix,
      key_hash: hash,
    });
    if (error) return { error: error.message };
    return { key };
  } catch (e) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : "Failed to create API key" };
  }
}

export async function revokeApiKey(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!isUuid(id)) return { error: "Invalid key id" };
  try {
    const { orgId } = await requireRole();
    const admin = createAdminClient();
    const { error } = await admin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("revoked_at", null);
    if (error) return { error: error.message };
    return { success: true };
  } catch (e) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : "Failed to revoke API key" };
  }
}
