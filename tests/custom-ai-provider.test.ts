// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import type { LookupFn } from "@/lib/security/fetch-target";

const KEY = "test-encryption-key-for-custom-ai-provider";
process.env.ENCRYPTION_KEY = KEY;

const { encrypt } = await import("@/lib/utils/encryption");
const {
  aiSdkBaseUrl,
  anthropicSdkBaseUrl,
  createCustomFetch,
  customModelFor,
  normalizeCustomBaseUrl,
  openCustomApiKey,
} = await import("@/lib/ai/custom-provider");
const { convertModelForProvider, getModelId, MODEL_MAP } = await import("@/lib/ai/models");

const FAKE_KEY = "sk-cs4-test";

afterEach(() => {
  process.env.ENCRYPTION_KEY = KEY;
});

describe("normalizeCustomBaseUrl", () => {
  it.each([
    ["https://api.llmsrelay.com", "https://api.llmsrelay.com"],
    ["  https://api.llmsrelay.com/  ", "https://api.llmsrelay.com"],
    ["https://api.llmsrelay.com///", "https://api.llmsrelay.com"],
    ["https://api.llmsrelay.com/v1", "https://api.llmsrelay.com"],
    ["https://api.llmsrelay.com/v1/", "https://api.llmsrelay.com"],
    ["https://relay.example.com/anthropic/v1", "https://relay.example.com/anthropic"],
    ["https://relay.example.com/anthropic/", "https://relay.example.com/anthropic"],
    ["https://API.LLMSRELAY.COM", "https://api.llmsrelay.com"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeCustomBaseUrl(input)).toBe(expected);
  });

  it.each([
    "http://api.llmsrelay.com",
    "ftp://api.llmsrelay.com",
    "https://user:pass@api.llmsrelay.com",
    "https://user@api.llmsrelay.com",
    "https://api.llmsrelay.com/?region=eu",
    "https://api.llmsrelay.com/?",
    "https://api.llmsrelay.com/#frag",
    "api.llmsrelay.com",
    "",
    "   ",
  ])("rejects %s", (input) => {
    expect(() => normalizeCustomBaseUrl(input)).toThrow(Error);
  });

  it("gives a user-readable message for a non-https URL", () => {
    expect(() => normalizeCustomBaseUrl("http://api.llmsrelay.com")).toThrow(/https/i);
  });
});

describe("SDK base URLs", () => {
  it("passes the base to @anthropic-ai/sdk and appends /v1 for @ai-sdk/anthropic", () => {
    expect(anthropicSdkBaseUrl("https://api.llmsrelay.com")).toBe("https://api.llmsrelay.com");
    expect(aiSdkBaseUrl("https://api.llmsrelay.com")).toBe("https://api.llmsrelay.com/v1");
  });
});

describe("customModelFor", () => {
  it("uses custom_model for sonnet and custom_fast_model for haiku", () => {
    const s = { custom_model: "claude-sonnet-4.6", custom_fast_model: "claude-haiku-4.5" };
    expect(customModelFor("sonnet", s)).toBe("claude-sonnet-4.6");
    expect(customModelFor("haiku", s)).toBe("claude-haiku-4.5");
  });

  it("falls back to custom_model for haiku when the fast model is missing or blank", () => {
    expect(customModelFor("haiku", { custom_model: "claude-sonnet-4.6" })).toBe("claude-sonnet-4.6");
    expect(customModelFor("haiku", { custom_model: "claude-sonnet-4.6", custom_fast_model: null })).toBe(
      "claude-sonnet-4.6"
    );
    expect(customModelFor("haiku", { custom_model: "claude-sonnet-4.6", custom_fast_model: "  " })).toBe(
      "claude-sonnet-4.6"
    );
  });

  it("returns null when no model is configured", () => {
    expect(customModelFor("sonnet", {})).toBeNull();
    expect(customModelFor("haiku", { custom_model: null, custom_fast_model: null })).toBeNull();
    expect(customModelFor("sonnet", { custom_model: " ", custom_fast_model: "claude-haiku-4.5" })).toBeNull();
  });
});

describe("openCustomApiKey", () => {
  it("round-trips a sealed key", () => {
    const sealed = encrypt(FAKE_KEY);
    expect(sealed).not.toContain(FAKE_KEY);
    expect(openCustomApiKey(sealed)).toBe(FAKE_KEY);
  });

  it("passes legacy plaintext through", () => {
    expect(openCustomApiKey(FAKE_KEY)).toBe(FAKE_KEY);
  });

  it("returns null for empty, tampered or wrong-key values", () => {
    expect(openCustomApiKey(null)).toBeNull();
    expect(openCustomApiKey(undefined)).toBeNull();
    expect(openCustomApiKey("")).toBeNull();

    const sealed = encrypt(FAKE_KEY);
    const [iv, tag, body] = sealed.split(":");
    const tampered = `${iv}:${tag}:${(body[0] === "0" ? "1" : "0") + body.slice(1)}`;
    expect(openCustomApiKey(tampered)).toBeNull();

    process.env.ENCRYPTION_KEY = "a-different-rotated-key";
    expect(openCustomApiKey(sealed)).toBeNull();
  });
});

function fakeLookup(table: Record<string, Array<{ address: string; family: number }>>): LookupFn {
  return async (host) => table[host] ?? [];
}

describe("createCustomFetch", () => {
  it.each(["https://127.0.0.1", "https://[::1]", "https://169.254.169.254", "https://localhost"])(
    "rejects the private/loopback base %s",
    async (base) => {
      await expect(createCustomFetch(base, fakeLookup({}))).rejects.toThrow();
    }
  );

  it("rejects a hostname that resolves to a private address", async () => {
    const lookup = fakeLookup({ "relay.evil.example": [{ address: "10.0.0.5", family: 4 }] });
    await expect(createCustomFetch("https://relay.evil.example", lookup)).rejects.toThrow();
  });

  it("rejects a non-https base", async () => {
    const lookup = fakeLookup({ "api.llmsrelay.com": [{ address: "93.184.216.34", family: 4 }] });
    await expect(createCustomFetch("http://api.llmsrelay.com", lookup)).rejects.toThrow();
  });

  it("returns a fetch pinned to the validated host", async () => {
    const lookup = fakeLookup({ "api.llmsrelay.com": [{ address: "93.184.216.34", family: 4 }] });
    const pinned = await createCustomFetch("https://api.llmsrelay.com", lookup);
    try {
      expect(typeof pinned.fetch).toBe("function");
      await expect(pinned.fetch("https://other.example.com/v1/models")).rejects.toThrow(/host mismatch/);
    } finally {
      await pinned.close();
    }
  });
});

describe("model ids for the custom provider", () => {
  const settings = { custom_model: "claude-sonnet-4.6", custom_fast_model: "claude-haiku-4.5" };

  it("getModelId returns the configured custom model per tier", () => {
    expect(getModelId("sonnet", "custom", settings)).toBe("claude-sonnet-4.6");
    expect(getModelId("haiku", "custom", settings)).toBe("claude-haiku-4.5");
    expect(getModelId("haiku", "custom", { custom_model: "claude-sonnet-4.6" })).toBe("claude-sonnet-4.6");
  });

  it("getModelId keeps existing ids for other providers", () => {
    expect(getModelId("sonnet", "anthropic", settings)).toBe(MODEL_MAP.sonnet);
    expect(getModelId("haiku", null)).toBe(MODEL_MAP.haiku);
    expect(getModelId("sonnet", "openrouter", settings)).toBe("anthropic/claude-sonnet-4.6");
  });

  it("convertModelForProvider maps Claude ids to the custom model and back", () => {
    expect(convertModelForProvider(MODEL_MAP.haiku, "custom", settings)).toBe("claude-haiku-4.5");
    expect(convertModelForProvider(MODEL_MAP.sonnet, "custom", settings)).toBe("claude-sonnet-4.6");
    expect(convertModelForProvider("claude-haiku-4.5", "anthropic", settings)).toBe(MODEL_MAP.haiku);
    expect(convertModelForProvider("claude-sonnet-4.6", "anthropic", settings)).toBe(MODEL_MAP.sonnet);
  });

  it("treats the configured fast model as the haiku tier even without haiku in its name", () => {
    const named = { custom_model: "relay-large", custom_fast_model: "relay-small" };
    expect(convertModelForProvider("relay-small", "anthropic", named)).toBe(MODEL_MAP.haiku);
    expect(convertModelForProvider("relay-large", "anthropic", named)).toBe(MODEL_MAP.sonnet);
  });
});
