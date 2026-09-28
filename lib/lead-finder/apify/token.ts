import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Canonical Apify token resolution.
 *
 * Env var precedence (for back-compat):
 *   1. APIFY_API_TOKEN   ← canonical, matches official Apify docs
 *   2. APIFY_TOKEN       ← legacy alias
 *   3. APIFY_API_KEY     ← legacy alias
 *
 * Tenant overrides live in `ai_settings.apify_api_key` and take precedence
 * over env when an `orgId` is supplied.
 *
 * All other modules in `lib/lead-finder/**` MUST call `getApifyToken(orgId)`
 * or `getApifyTokenFromEnv()` instead of reading `process.env.APIFY_*`
 * directly.
 */

export function getApifyTokenFromEnv(): string | undefined {
  return (
    process.env.APIFY_API_TOKEN ||
    process.env.APIFY_TOKEN ||
    process.env.APIFY_API_KEY ||
    undefined
  );
}

async function loadTenantApifyKey(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_settings")
    .select("apify_api_key")
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();
  return (data?.apify_api_key as string | null) ?? null;
}

/**
 * Resolve the Apify token with tenant override. Returns undefined when no
 * token is configured. Pass `orgId` to include the per-tenant override from
 * `ai_settings.apify_api_key`; omit to consult env only.
 */
export async function tryGetApifyToken(
  orgId?: string
): Promise<string | undefined> {
  if (orgId) {
    const dbKey = await loadTenantApifyKey(orgId);
    if (dbKey) return dbKey;
  }
  return getApifyTokenFromEnv();
}

/**
 * Resolve the Apify token with tenant override, throwing a stable error when
 * no token is configured anywhere.
 */
export async function getApifyToken(orgId?: string): Promise<string> {
  const token = await tryGetApifyToken(orgId);
  if (!token) {
    throw new Error(
      "Apify token not configured. Set it in Lead Finder Settings or as APIFY_API_TOKEN (APIFY_TOKEN / APIFY_API_KEY also accepted for back-compat)."
    );
  }
  return token;
}
