import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Per-workspace API keys for the MCP server (table api_keys, migration 036).
 *
 * Format: "pcrm_" + 43 base64url chars (32 random bytes). Only the SHA-256
 * hash is stored; the plaintext is shown once when the key is created.
 */

export const API_KEY_PREFIX = "pcrm_";
const KEY_RE = /^pcrm_[A-Za-z0-9_-]{43}$/;

export type ApiKeyScope = "read" | "write";

export interface ApiKeyContext {
  keyId: string;
  orgId: string;
  scope: ApiKeyScope;
  /** Profile that created the key; used as created_by/author on writes. */
  createdBy: string | null;
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = API_KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function isWellFormedApiKey(value: string): boolean {
  return KEY_RE.test(value);
}

/** Pulls the key out of "Authorization: Bearer <key>" (or x-api-key). */
export function extractApiKey(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth) {
    const match = /^Bearer\s+(\S+)$/i.exec(auth.trim());
    return match ? match[1] : null;
  }
  return headers.get("x-api-key")?.trim() || null;
}

/**
 * Resolves a key to its workspace. Returns null for malformed, unknown or
 * revoked keys. The lookup is by hash, so no timing-safe compare is needed.
 */
export async function authenticateApiKey(key: string | null): Promise<ApiKeyContext | null> {
  if (!key || !isWellFormedApiKey(key)) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, organization_id, scope, created_by, revoked_at, last_used_at")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Throttle last_used_at writes to one a minute per key.
  const lastUsed = data.last_used_at ? Date.parse(data.last_used_at) : 0;
  if (Date.now() - lastUsed > 60_000) {
    // Awaited: a serverless function may be frozen before a dangling write lands.
    await admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  return {
    keyId: data.id,
    orgId: data.organization_id,
    scope: data.scope === "write" ? "write" : "read",
    createdBy: data.created_by,
  };
}
