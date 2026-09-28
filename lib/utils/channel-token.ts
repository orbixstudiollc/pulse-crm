import { encrypt, decrypt } from "@/lib/utils/encryption";
import { isSealedValue } from "@/lib/email/oauth-tokens";

/** Seals a channel (WhatsApp/LinkedIn) token for storage. Throws if ENCRYPTION_KEY is unset. */
export function sealChannelToken(plain: string): string {
  return encrypt(plain);
}

/**
 * Returns the plaintext channel token. Legacy plaintext values pass through
 * unchanged; sealed values that fail to decrypt (tampered, wrong key) return null.
 */
export function openChannelToken(v: string | null | undefined): string | null {
  if (!v) return null;
  if (!isSealedValue(v)) return v;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}
