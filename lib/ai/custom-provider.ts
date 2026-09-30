/**
 * Org-configured Anthropic-compatible endpoint (provider value "custom"),
 * e.g. LLMsRelay. The base URL is tenant-supplied, so every request goes
 * through a fetch pinned to the validated public addresses (SSRF / DNS
 * rebinding safe). The API key is stored sealed with encrypt(), bound by GCM
 * additional authenticated data to its purpose, the org and the base URL, so
 * it cannot be replayed for another org or URL and no other sealed secret can
 * be passed off as it.
 *
 * Plain module (no server-only imports) so it can be unit tested directly.
 */

import { decrypt, encrypt } from "@/lib/utils/encryption";
import { isSealedValue } from "@/lib/email/oauth-tokens";
import { assertSafeFetchTarget, type LookupFn } from "@/lib/security/fetch-target";
import { createPinnedFetch } from "@/lib/security/safe-fetch";

export interface CustomModelSettings {
  custom_model?: string | null;
  custom_fast_model?: string | null;
}

/**
 * Normalize a tenant-supplied base URL: https only on the default port 443,
 * no credentials, query or fragment; trailing slashes and a trailing /v1 are
 * removed. Throws an Error with a user-readable message when the URL is not
 * acceptable.
 */
export function normalizeCustomBaseUrl(input: string): string {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Base URL must be a valid URL, e.g. https://api.llmsrelay.com");
  }
  if (url.protocol !== "https:") throw new Error("Base URL must use https://");
  // URL drops the default port, so any port left here is not 443.
  if (url.port && url.port !== "443") throw new Error("Base URL must not use a port other than 443");
  if (url.username || url.password) throw new Error("Base URL must not contain a username or password");
  if (url.search || url.hash || /[?#]/.test(trimmed)) {
    throw new Error("Base URL must not contain a query string or fragment");
  }
  const path = url.pathname.replace(/\/+$/, "").replace(/\/v1$/i, "").replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

/** Base for @anthropic-ai/sdk, which appends /v1/messages itself. */
export function anthropicSdkBaseUrl(base: string): string {
  return base;
}

/** Base for @ai-sdk/anthropic, which expects the /v1 base. */
export function aiSdkBaseUrl(base: string): string {
  return `${base}/v1`;
}

/** The configured model for a tier; haiku falls back to custom_model. */
export function customModelFor(
  tier: "sonnet" | "haiku",
  s: CustomModelSettings
): string | null {
  const main = s.custom_model?.trim() || null;
  if (tier === "haiku") return s.custom_fast_model?.trim() || main;
  return main;
}

/** GCM additional authenticated data for the custom API key of one org and URL. */
export function customKeyAad(orgId: string, normalizedBaseUrl: string): string {
  return `custom_ai_key:v1:${orgId}:${normalizedBaseUrl}`;
}

/**
 * Seal the API key for one org and base URL. Throws when the URL is not
 * acceptable (see normalizeCustomBaseUrl) or encryption is not configured.
 */
export function sealCustomApiKey(plain: string, orgId: string, baseUrl: string): string {
  if (!orgId) throw new Error("Organization is required to seal the API key");
  return encrypt(plain, customKeyAad(orgId, normalizeCustomBaseUrl(baseUrl)));
}

/**
 * The plaintext API key, or null unless `sealed` was sealed by
 * sealCustomApiKey for this org and (normalized) base URL. Plaintext,
 * tampered values, other sealed secrets and a wrong key all return null.
 */
export function openCustomApiKey(
  sealed: string | null | undefined,
  orgId: string | null | undefined,
  baseUrl: string | null | undefined
): string | null {
  if (!sealed || !orgId || !baseUrl || !isSealedValue(sealed)) return null;
  try {
    return decrypt(sealed, customKeyAad(orgId, normalizeCustomBaseUrl(baseUrl)));
  } catch {
    return null;
  }
}

/**
 * A fetch pinned to the base URL's validated public addresses, plus `base`,
 * the normalized URL the SDK must use. Call close() when the request is
 * done. `lookup` is injectable for tests.
 */
export async function createCustomFetch(
  base: string,
  lookup?: LookupFn
): Promise<{ fetch: typeof fetch; close: () => Promise<void>; base: string }> {
  const normalized = normalizeCustomBaseUrl(base);
  let target;
  try {
    target = await assertSafeFetchTarget(normalized, lookup);
  } catch {
    throw new Error("Custom AI base URL is not allowed");
  }
  return { ...createPinnedFetch(target), base: normalized };
}
