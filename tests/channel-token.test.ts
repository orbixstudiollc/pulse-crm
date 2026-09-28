import { afterEach, describe, expect, it } from "vitest";

const KEY = "test-encryption-key-for-channel-tokens";
process.env.ENCRYPTION_KEY = KEY;

const { isSealedValue } = await import("@/lib/email/oauth-tokens");
const { openChannelToken, sealChannelToken } = await import("@/lib/utils/channel-token");

const TOKEN = "EAAG-whatsapp-access-token";

afterEach(() => {
  process.env.ENCRYPTION_KEY = KEY;
});

describe("channel token sealing", () => {
  it("round-trips seal -> open", () => {
    const sealed = sealChannelToken(TOKEN);
    expect(isSealedValue(sealed)).toBe(true);
    expect(sealed).not.toContain(TOKEN);
    expect(openChannelToken(sealed)).toBe(TOKEN);
  });

  it("passes legacy plaintext tokens through unchanged", () => {
    expect(openChannelToken(TOKEN)).toBe(TOKEN);
  });

  it("returns null for tampered ciphertext", () => {
    const sealed = sealChannelToken(TOKEN);
    const [iv, tag, body] = sealed.split(":");
    const flipped = (body[0] === "0" ? "1" : "0") + body.slice(1);
    const tampered = `${iv}:${tag}:${flipped}`;
    expect(isSealedValue(tampered)).toBe(true);
    expect(openChannelToken(tampered)).toBeNull();
  });

  it("returns null when opened with a different ENCRYPTION_KEY", () => {
    const sealed = sealChannelToken(TOKEN);
    process.env.ENCRYPTION_KEY = "a-different-rotated-key";
    expect(openChannelToken(sealed)).toBeNull();
  });

  it("returns null for null, undefined and empty values", () => {
    expect(openChannelToken(null)).toBeNull();
    expect(openChannelToken(undefined)).toBeNull();
    expect(openChannelToken("")).toBeNull();
  });

  it("sealChannelToken throws when ENCRYPTION_KEY is unset", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => sealChannelToken(TOKEN)).toThrow();
  });
});
