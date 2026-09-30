// @vitest-environment node
import { describe, expect, it } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-for-provider-resolver";

const { encrypt } = await import("@/lib/utils/encryption");
const { sealCustomApiKey } = await import("@/lib/ai/custom-provider");
const { AI_PROVIDER_ORDER, resolveAIProvider } = await import("@/lib/ai/provider-resolver");

const NOW = Date.parse("2026-09-30T12:00:00Z");

describe("resolveAIProvider", () => {
  it("uses an explicitly chosen provider that has an org key", () => {
    expect(
      resolveAIProvider(
        { ai_provider: "groq", api_key: "sk-ant", groq_api_key: "gsk" },
        {},
        NOW
      )
    ).toEqual({ provider: "groq", apiKey: "gsk" });
  });

  it("uses an explicitly chosen provider whose only credential is in env", () => {
    expect(
      resolveAIProvider({ ai_provider: "openai", api_key: "sk-ant" }, { OPENAI_API_KEY: "sk-env" }, NOW)
    ).toEqual({ provider: "openai", apiKey: "sk-env" });
  });

  it("falls back in order when the explicit provider has no credential", () => {
    expect(
      resolveAIProvider(
        { ai_provider: "anthropic", openai_api_key: "sk-oai", groq_api_key: "gsk" },
        {},
        NOW
      )
    ).toEqual({ provider: "openai", apiKey: "sk-oai" });
    expect(
      resolveAIProvider({ ai_provider: "anthropic", openrouter_api_key: "or-key" }, {}, NOW)
    ).toEqual({ provider: "openrouter", apiKey: "or-key" });
  });

  it("treats unknown or empty provider values as no explicit choice", () => {
    expect(
      resolveAIProvider({ ai_provider: "auto", groq_api_key: "gsk" }, {}, NOW)
    ).toEqual({ provider: "groq", apiKey: "gsk" });
    expect(resolveAIProvider({ ai_provider: "", ollama_base_url: "https://llm.example.com/v1" }, {}, NOW)).toEqual({
      provider: "ollama",
      baseURL: "https://llm.example.com/v1",
    });
  });

  it("prefers an unexpired OpenRouter OAuth token and ignores an expired one", () => {
    const base = { ai_provider: "openrouter", openrouter_oauth_token: "oauth-tok" };
    expect(
      resolveAIProvider(
        { ...base, openrouter_api_key: "or-key", openrouter_expires_at: "2026-10-01T00:00:00Z" },
        {},
        NOW
      )
    ).toEqual({ provider: "openrouter", apiKey: "oauth-tok" });
    expect(
      resolveAIProvider(
        { ...base, openrouter_api_key: "or-key", openrouter_expires_at: "2026-09-01T00:00:00Z" },
        {},
        NOW
      )
    ).toEqual({ provider: "openrouter", apiKey: "or-key" });
    // Expired token and no other OpenRouter key: fall back to what else exists.
    expect(
      resolveAIProvider(
        { ...base, openrouter_expires_at: "2026-09-01T00:00:00Z", openai_api_key: "sk-oai" },
        {},
        NOW
      )
    ).toEqual({ provider: "openai", apiKey: "sk-oai" });
    // Missing expiry is treated as expired.
    expect(resolveAIProvider(base, {}, NOW)).toBeNull();
  });

  it("falls back to env keys in order when the org has none", () => {
    expect(
      resolveAIProvider({}, { GROQ_API_KEY: "gsk-env", OPENROUTER_API_KEY: "or-env" }, NOW)
    ).toEqual({ provider: "openrouter", apiKey: "or-env" });
    expect(resolveAIProvider({ ai_provider: null }, { OLLAMA_BASE_URL: "https://ollama.example.com/v1" }, NOW)).toEqual({
      provider: "ollama",
      baseURL: "https://ollama.example.com/v1",
    });
  });

  it("prefers org credentials over env credentials", () => {
    expect(
      resolveAIProvider({ api_key: "sk-org" }, { ANTHROPIC_API_KEY: "sk-env" }, NOW)
    ).toEqual({ provider: "anthropic", apiKey: "sk-org" });
    expect(
      resolveAIProvider({ groq_api_key: "gsk-org" }, { ANTHROPIC_API_KEY: "sk-env" }, NOW)
    ).toEqual({ provider: "groq", apiKey: "gsk-org" });
  });

  it("returns null when nothing is configured", () => {
    expect(resolveAIProvider({}, {}, NOW)).toBeNull();
    expect(resolveAIProvider({ ai_provider: "anthropic" }, {}, NOW)).toBeNull();
  });

  describe("custom provider", () => {
    const BASE = "https://api.llmsrelay.com";
    const FAKE_KEY = "sk-cs4-test";
    const ORG = "00000000-0000-4000-8000-000000000001";
    const OTHER_ORG = "00000000-0000-4000-8000-000000000002";
    const seal = (key: string, org = ORG, base = BASE) => sealCustomApiKey(key, org, base);

    it("needs both a base URL and a decryptable key", () => {
      expect(
        resolveAIProvider({ ai_provider: "custom", organization_id: ORG, custom_base_url: BASE }, {}, NOW)
      ).toBeNull();
      expect(
        resolveAIProvider({ ai_provider: "custom", organization_id: ORG, custom_api_key: seal(FAKE_KEY) }, {}, NOW)
      ).toBeNull();
      const sealed = seal(FAKE_KEY);
      const [iv, tag, body] = sealed.split(":");
      const tampered = `${iv}:${tag}:${(body[0] === "0" ? "1" : "0") + body.slice(1)}`;
      expect(
        resolveAIProvider(
          { ai_provider: "custom", organization_id: ORG, custom_base_url: BASE, custom_api_key: tampered },
          {},
          NOW
        )
      ).toBeNull();
      // Plaintext and other sealed secrets (no custom key AAD) are refused.
      expect(
        resolveAIProvider(
          { ai_provider: "custom", organization_id: ORG, custom_base_url: BASE, custom_api_key: FAKE_KEY },
          {},
          NOW
        )
      ).toBeNull();
      expect(
        resolveAIProvider(
          { ai_provider: "custom", organization_id: ORG, custom_base_url: BASE, custom_api_key: encrypt(FAKE_KEY) },
          {},
          NOW
        )
      ).toBeNull();
    });

    it("only opens a key sealed for the same org and base URL", () => {
      const settings = { ai_provider: "custom", custom_base_url: BASE };
      expect(
        resolveAIProvider({ ...settings, organization_id: ORG, custom_api_key: seal(FAKE_KEY, OTHER_ORG) }, {}, NOW)
      ).toBeNull();
      expect(
        resolveAIProvider(
          { ...settings, organization_id: ORG, custom_api_key: seal(FAKE_KEY, ORG, "https://attacker.example.com") },
          {},
          NOW
        )
      ).toBeNull();
      expect(resolveAIProvider({ ...settings, custom_api_key: seal(FAKE_KEY) }, {}, NOW)).toBeNull();
      expect(
        resolveAIProvider({ ...settings, organization_id: ORG, custom_api_key: seal(FAKE_KEY) }, {}, NOW)
      ).toEqual({ provider: "custom", apiKey: FAKE_KEY, baseURL: BASE });
    });

    it("uses an explicitly chosen custom provider and decrypts its key", () => {
      expect(
        resolveAIProvider(
          {
            ai_provider: "custom",
            organization_id: ORG,
            api_key: "sk-ant",
            custom_base_url: BASE,
            custom_api_key: seal(FAKE_KEY),
          },
          { ANTHROPIC_API_KEY: "sk-env" },
          NOW
        )
      ).toEqual({ provider: "custom", apiKey: FAKE_KEY, baseURL: BASE });
    });

    it("never uses an env key for the custom provider", () => {
      const env = {
        ANTHROPIC_API_KEY: "sk-env",
        OPENAI_API_KEY: "sk-oai-env",
        CUSTOM_API_KEY: "sk-cs4-env",
        CUSTOM_BASE_URL: BASE,
      };
      const resolved = resolveAIProvider({ ai_provider: "custom", custom_base_url: BASE }, env, NOW);
      expect(resolved?.provider).not.toBe("custom");
      expect(resolved).toEqual({ provider: "anthropic", apiKey: "sk-env" });
      expect(resolveAIProvider({ ai_provider: "custom" }, { CUSTOM_API_KEY: "sk-cs4-env" }, NOW)).toBeNull();
    });

    it("is last in the fallback order", () => {
      expect(AI_PROVIDER_ORDER[AI_PROVIDER_ORDER.length - 1]).toBe("custom");
      const custom = { organization_id: ORG, custom_base_url: BASE, custom_api_key: seal(FAKE_KEY) };
      expect(resolveAIProvider({ ...custom, groq_api_key: "gsk" }, {}, NOW)).toEqual({
        provider: "groq",
        apiKey: "gsk",
      });
      expect(resolveAIProvider(custom, {}, NOW)).toEqual({ provider: "custom", apiKey: FAKE_KEY, baseURL: BASE });
      // An org custom credential still beats env credentials.
      expect(resolveAIProvider(custom, { ANTHROPIC_API_KEY: "sk-env" }, NOW)?.provider).toBe("custom");
    });
  });
});
