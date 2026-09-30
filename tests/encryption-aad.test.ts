// @vitest-environment node
import { describe, expect, it } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-for-aad";

const { encrypt, decrypt } = await import("@/lib/utils/encryption");

const FAKE_SECRET = "sk-aad-test";
const SEALED_RE = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]*$/;

describe("encrypt/decrypt with additional authenticated data", () => {
  it("round-trips with the same AAD and keeps the iv:tag:ciphertext format", () => {
    const sealed = encrypt(FAKE_SECRET, "purpose:org-1");
    expect(sealed).toMatch(SEALED_RE);
    expect(sealed).not.toContain(FAKE_SECRET);
    expect(decrypt(sealed, "purpose:org-1")).toBe(FAKE_SECRET);
  });

  it("fails with a different AAD or without the AAD", () => {
    const sealed = encrypt(FAKE_SECRET, "purpose:org-1");
    expect(() => decrypt(sealed, "purpose:org-2")).toThrow();
    expect(() => decrypt(sealed)).toThrow();
  });

  it("leaves values sealed without AAD unchanged", () => {
    const sealed = encrypt(FAKE_SECRET);
    expect(sealed).toMatch(SEALED_RE);
    expect(decrypt(sealed)).toBe(FAKE_SECRET);
    // A value sealed without AAD cannot be opened as if it had one.
    expect(() => decrypt(sealed, "purpose:org-1")).toThrow();
  });

  it("rejects a truncated authentication tag", () => {
    const [iv, tag, body] = encrypt(FAKE_SECRET, "purpose:org-1").split(":");
    expect(() => decrypt(`${iv}:${tag.slice(0, 8)}:${body}`, "purpose:org-1")).toThrow();
  });
});
