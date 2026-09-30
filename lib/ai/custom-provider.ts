/**
 * Org-configured Anthropic-compatible endpoint (provider value "custom"),
 * e.g. LLMsRelay. The base URL is tenant-supplied, so every request goes
 * through a fetch pinned to the validated public addresses (SSRF / DNS
 * rebinding safe). The API key is stored sealed with encrypt().
 *
 * Plain module (no server-only imports) so it can be unit tested directly.
 */

import { decrypt } from "@/lib/utils/encryption";
import { isSealedValue } from "@/lib/email/oauth-tokens";
import { assertSafeFetchTarget, type LookupFn } from "@/lib/security/fetch-target";
import { createPinnedFetch } from "@/lib/security/safe-fetch";

export interface CustomModelSettings {
  custom_model?: string | null;
  custom_fast_model?: string | null;
}

/**
 * Normalize a tenant-supplied base URL: https only, no credentials, query or
 * fragment; trailing slashes and a trailing /v1 are removed. Throws an Error
 * with a user-readable message when the URL is not acceptable.
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

/**
 * The plaintext API key. Legacy plaintext passes through; sealed values that
 * fail to decrypt (tampered, wrong key) return null.
 */
export function openCustomApiKey(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  if (!isSealedValue(sealed)) return sealed;
  try {
    return decrypt(sealed);
  } catch {
    return null;
  }
}

/**
 * A fetch pinned to the base URL's validated public addresses. Call close()
 * when the request is done. `lookup` is injectable for tests.
 */
export async function createCustomFetch(
  base: string,
  lookup?: LookupFn
): Promise<{ fetch: typeof fetch; close: () => Promise<void> }> {
  const normalized = normalizeCustomBaseUrl(base);
  let target;
  try {
    target = await assertSafeFetchTarget(normalized, lookup);
  } catch {
    throw new Error("Custom AI base URL is not allowed");
  }
  return createPinnedFetch(target);
}
