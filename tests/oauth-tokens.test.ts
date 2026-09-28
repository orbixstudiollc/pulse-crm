import { afterEach, describe, expect, it } from "vitest";

const KEY = "test-encryption-key-for-oauth-tokens";
process.env.ENCRYPTION_KEY = KEY;

const { isSealedValue, openOAuthTokens, sealOAuthTokens } = await import("@/lib/email/oauth-tokens");

const PLAIN = {
  access_token: "ya29.access-token",
  refresh_token: "1//refresh-token",
  expires_at: 1_700_000_000_000,
  scope: "https://www.googleapis.com/auth/gmail.send",
};

afterEach(() => {
  process.env.ENCRYPTION_KEY = KEY;
});

describe("OAuth token sealing", () => {
  it("round-trips seal -> open and seals both tokens", () => {
    const sealed = sealOAuthTokens(PLAIN);
    expect(isSealedValue(sealed.access_token)).toBe(true);
    expect(isSealedValue(sealed.refresh_token)).toBe(true);
    expect(sealed.access_token).not.toContain(PLAIN.access_token);
    expect(sealed.expires_at).toBe(PLAIN.expires_at);
    expect(sealed.scope).toBe(PLAIN.scope);
    expect(openOAuthTokens(sealed)).toEqual(PLAIN);
  });

  it("passes legacy plaintext tokens through unchanged", () => {
    expect(isSealedValue(PLAIN.access_token)).toBe(false);
    expect(openOAuthTokens(PLAIN)).toEqual(PLAIN);
  });

  it("opens a mixed row with one sealed and one plaintext value", () => {
    const sealed = sealOAuthTokens(PLAIN);
    const mixed = { ...PLAIN, access_token: sealed.access_token };
    expect(openOAuthTokens(mixed)).toEqual(PLAIN);
  });

  it("fails closed on tampered ciphertext", () => {
    const sealed = sealOAuthTokens(PLAIN);
    const last = sealed.access_token.slice(-1);
    const tampered = sealed.access_token.slice(0, -1) + (last === "0" ? "1" : "0");
    expect(isSealedValue(tampered)).toBe(true);
    expect(openOAuthTokens({ ...sealed, access_token: tampered })).toBeNull();
  });

  it("fails closed when opened with a different key", () => {
    const sealed = sealOAuthTokens(PLAIN);
    process.env.ENCRYPTION_KEY = "a-different-rotated-key";
    expect(openOAuthTokens(sealed)).toBeNull();
  });

  it("keeps an absent refresh_token absent", () => {
    const sealed = sealOAuthTokens({ access_token: "ya29.only-access" });
    expect("refresh_token" in sealed).toBe(false);
    expect(JSON.stringify(sealed)).not.toContain("undefined");
    expect(openOAuthTokens(sealed)).toEqual({ access_token: "ya29.only-access" });
  });

  it("returns null for missing tokens", () => {
    expect(openOAuthTokens(null)).toBeNull();
    expect(openOAuthTokens({})).toBeNull();
  });
});
