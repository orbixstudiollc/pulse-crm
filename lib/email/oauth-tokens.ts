import { decrypt, encrypt } from "@/lib/utils/encryption";

// A type alias (not an interface) so it stays assignable to the Supabase `Json` column type
export type OAuthTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  scope?: string;
};

// encrypt() output: 16-byte IV (32 hex) : 16-byte GCM tag (32 hex) : ciphertext hex
const SEALED_RE = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]*$/i;

export function isSealedValue(v: unknown): v is string {
  return typeof v === "string" && SEALED_RE.test(v);
}

export function sealOAuthTokens(t: OAuthTokens): OAuthTokens {
  const sealed: OAuthTokens = { ...t, access_token: encrypt(t.access_token) };
  if (t.refresh_token) sealed.refresh_token = encrypt(t.refresh_token);
  else delete sealed.refresh_token;
  return sealed;
}

/**
 * Returns plaintext tokens. Legacy plaintext values pass through unchanged;
 * sealed values are decrypted. Returns null (fail closed) when a sealed value
 * cannot be decrypted, e.g. after an ENCRYPTION_KEY rotation or tampering.
 */
export function openOAuthTokens(t: unknown): OAuthTokens | null {
  if (!t || typeof t !== "object") return null;
  const raw = t as Record<string, unknown>;
  if (typeof raw.access_token !== "string") return null;

  const open = (v: string): string => (isSealedValue(v) ? decrypt(v) : v);

  try {
    const tokens: OAuthTokens = { access_token: open(raw.access_token) };
    if (typeof raw.refresh_token === "string") tokens.refresh_token = open(raw.refresh_token);
    if (typeof raw.expires_at === "number") tokens.expires_at = raw.expires_at;
    if (typeof raw.scope === "string") tokens.scope = raw.scope;
    return tokens;
  } catch {
    return null;
  }
}
