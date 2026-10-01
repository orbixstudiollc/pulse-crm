// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-for-provider-resolver";

const { encrypt } = await import("@/lib/utils/encryption");
const { sealCustomApiKey } = await import("@/lib/ai/custom-provider");
const { AI_PROVIDER_ORDER, customModelSettingsFor, resolveAIProvider } = await import(
  "@/lib/ai/provider-resolver"
);

const NOW = Date.parse("2026-09-30T12:00:00Z");

describe("resolveAIProvider", () => {
  it("uses an explicitly chosen provider that has an org key", () => {
    expect(
      resolveAIProvider(
        { ai_provider: "groq", api_key: "sk-ant", groq_api_key: "gsk" },
        {},
        NOW
      )
    ).toEqual({ provider: "groq", source: "org", apiKey: "gsk" });
  });

  it("uses an explicitly chosen provider whose only credential is in env", () => {
    expect(
      resolveAIProvider({ ai_provider: "openai", api_key: "sk-ant" }, { OPENAI_API_KEY: "sk-env" }, NOW)
    ).toEqual({ provider: "openai", source: "env", apiKey: "sk-env" });
  });

  it("falls back in order when the explicit provider has no credential", () => {
    expect(
      resolveAIProvider(
        { ai_provider: "anthropic", openai_api_key: "sk-oai", groq_api_key: "gsk" },
        {},
        NOW
      )
    ).toEqual({ provider: "openai", source: "org", apiKey: "sk-oai" });
    expect(
      resolveAIProvider({ ai_provider: "anthropic", openrouter_api_key: "or-key" }, {}, NOW)
    ).toEqual({ provider: "openrouter", source: "org", apiKey: "or-key" });
  });

  it("treats unknown or empty provider values as no explicit choice", () => {
    expect(
      resolveAIProvider({ ai_provider: "auto", groq_api_key: "gsk" }, {}, NOW)
    ).toEqual({ provider: "groq", source: "org", apiKey: "gsk" });
    expect(resolveAIProvider({ ai_provider: "", ollama_base_url: "https://llm.example.com/v1" }, {}, NOW)).toEqual({
      provider: "ollama",
      source: "org",
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
    ).toEqual({ provider: "openrouter", source: "org", apiKey: "oauth-tok" });
    expect(
      resolveAIProvider(
        { ...base, openrouter_api_key: "or-key", openrouter_expires_at: "2026-09-01T00:00:00Z" },
        {},
        NOW
      )
    ).toEqual({ provider: "openrouter", source: "org", apiKey: "or-key" });
    // Expired token and no other OpenRouter key: fall back to what else exists.
    expect(
      resolveAIProvider(
        { ...base, openrouter_expires_at: "2026-09-01T00:00:00Z", openai_api_key: "sk-oai" },
        {},
        NOW
      )
    ).toEqual({ provider: "openai", source: "org", apiKey: "sk-oai" });
    // Missing expiry is treated as expired.
    expect(resolveAIProvider(base, {}, NOW)).toBeNull();
  });

  it("falls back to env keys in order when the org has none", () => {
    expect(
      resolveAIProvider({}, { GROQ_API_KEY: "gsk-env", OPENROUTER_API_KEY: "or-env" }, NOW)
    ).toEqual({ provider: "openrouter", source: "env", apiKey: "or-env" });
    expect(resolveAIProvider({ ai_provider: null }, { OLLAMA_BASE_URL: "https://ollama.example.com/v1" }, NOW)).toEqual({
      provider: "ollama",
      source: "env",
      baseURL: "https://ollama.example.com/v1",
    });
  });

  it("prefers org credentials over env credentials", () => {
    expect(
      resolveAIProvider({ api_key: "sk-org" }, { ANTHROPIC_API_KEY: "sk-env" }, NOW)
    ).toEqual({ provider: "anthropic", source: "org", apiKey: "sk-org" });
    expect(
      resolveAIProvider({ groq_api_key: "gsk-org" }, { ANTHROPIC_API_KEY: "sk-env" }, NOW)
    ).toEqual({ provider: "groq", source: "org", apiKey: "gsk-org" });
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
      ).toEqual({ provider: "custom", source: "org", apiKey: FAKE_KEY, baseURL: BASE });
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
      ).toEqual({ provider: "custom", source: "org", apiKey: FAKE_KEY, baseURL: BASE });
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
      expect(resolved).toEqual({ provider: "anthropic", source: "env", apiKey: "sk-env" });
      expect(resolveAIProvider({ ai_provider: "custom" }, { CUSTOM_API_KEY: "sk-cs4-env" }, NOW)).toBeNull();
    });

    it("is last in the fallback order", () => {
      expect(AI_PROVIDER_ORDER[AI_PROVIDER_ORDER.length - 1]).toBe("custom");
      const custom = { organization_id: ORG, custom_base_url: BASE, custom_api_key: seal(FAKE_KEY) };
      expect(resolveAIProvider({ ...custom, groq_api_key: "gsk" }, {}, NOW)).toEqual({
        provider: "groq",
        source: "org",
        apiKey: "gsk",
      });
      expect(resolveAIProvider(custom, {}, NOW)).toEqual({
        provider: "custom",
        source: "org",
        apiKey: FAKE_KEY,
        baseURL: BASE,
      });
      // An org custom credential still beats env credentials.
      expect(resolveAIProvider(custom, { ANTHROPIC_API_KEY: "sk-env" }, NOW)?.provider).toBe("custom");
    });
  });

  describe("server-wide custom fallback (CUSTOM_AI_* env)", () => {
    const ENV_BASE = "https://api.llmsrelay.com";
    const ENV_KEY = "sk-env-relay-test";
    const ORG = "00000000-0000-4000-8000-000000000001";
    const OTHER_ORG = "00000000-0000-4000-8000-000000000002";
    const ORG_BASE = "https://attacker.example.com";
    const ORG_KEY = "sk-org-relay-test";
    const ENV = { CUSTOM_AI_BASE_URL: `${ENV_BASE}/v1/`, CUSTOM_AI_API_KEY: ENV_KEY };
    const ENV_RESOLVED = {
      provider: "custom",
      source: "env",
      apiKey: ENV_KEY,
      baseURL: ENV_BASE,
      model: "claude-sonnet-4.6",
      fastModel: "claude-haiku-4.5",
    };

    it("is used, with its normalized URL and default models, when the workspace has no key", () => {
      expect(resolveAIProvider({}, ENV, NOW)).toEqual(ENV_RESOLVED);
      expect(resolveAIProvider({ ai_provider: null, organization_id: ORG }, ENV, NOW)).toEqual(ENV_RESOLVED);
    });

    it("uses CUSTOM_AI_MODEL and CUSTOM_AI_FAST_MODEL when set", () => {
      expect(
        resolveAIProvider(
          {},
          { ...ENV, CUSTOM_AI_MODEL: " relay-large ", CUSTOM_AI_FAST_MODEL: "relay-small" },
          NOW
        )
      ).toEqual({ ...ENV_RESOLVED, model: "relay-large", fastModel: "relay-small" });
    });

    it("is ignored when either variable is missing", () => {
      expect(resolveAIProvider({}, { CUSTOM_AI_BASE_URL: ENV_BASE }, NOW)).toBeNull();
      expect(resolveAIProvider({}, { CUSTOM_AI_API_KEY: ENV_KEY }, NOW)).toBeNull();
      expect(resolveAIProvider({}, { CUSTOM_AI_BASE_URL: ENV_BASE, CUSTOM_AI_API_KEY: "  " }, NOW)).toBeNull();
      expect(resolveAIProvider({}, { CUSTOM_AI_BASE_URL: "", CUSTOM_AI_API_KEY: ENV_KEY }, NOW)).toBeNull();
    });

    it.each([
      "http://api.llmsrelay.com",
      "https://api.llmsrelay.com:8443",
      "https://api.llmsrelay.com/?region=eu",
      "https://user:pass@api.llmsrelay.com",
      "api.llmsrelay.com",
    ])("is ignored when the URL is invalid (%s)", (url) => {
      expect(resolveAIProvider({}, { CUSTOM_AI_BASE_URL: url, CUSTOM_AI_API_KEY: ENV_KEY }, NOW)).toBeNull();
      // Another credential still resolves.
      expect(
        resolveAIProvider({}, { CUSTOM_AI_BASE_URL: url, CUSTOM_AI_API_KEY: ENV_KEY, GROQ_API_KEY: "gsk-env" }, NOW)
      ).toEqual({ provider: "groq", source: "env", apiKey: "gsk-env" });
    });

    it("is tried after every org credential and every other env credential", () => {
      expect(resolveAIProvider({ groq_api_key: "gsk-org" }, ENV, NOW)).toEqual({
        provider: "groq",
        source: "org",
        apiKey: "gsk-org",
      });
      expect(resolveAIProvider({}, { ...ENV, ANTHROPIC_API_KEY: "sk-env" }, NOW)).toEqual({
        provider: "anthropic",
        source: "env",
        apiKey: "sk-env",
      });
      // Even an explicit custom choice without an org key does not move it ahead.
      expect(resolveAIProvider({ ai_provider: "custom" }, { ...ENV, GROQ_API_KEY: "gsk-env" }, NOW)).toEqual({
        provider: "groq",
        source: "env",
        apiKey: "gsk-env",
      });
    });

    it("beats env Ollama in the env pass, so a set OLLAMA_BASE_URL cannot shadow it", () => {
      const env = { ...ENV, OLLAMA_BASE_URL: "http://localhost:11434" };
      expect(resolveAIProvider({}, env, NOW)).toEqual(ENV_RESOLVED);
      // Env Ollama still resolves when no env custom credential exists.
      expect(resolveAIProvider({}, { OLLAMA_BASE_URL: "https://ollama.example.com/v1" }, NOW)).toEqual({
        provider: "ollama",
        source: "env",
        baseURL: "https://ollama.example.com/v1",
      });
      // An org Ollama URL still beats env custom: the org order is unchanged.
      expect(resolveAIProvider({ ollama_base_url: "https://org-ollama.example.com/v1" }, env, NOW)).toEqual({
        provider: "ollama",
        source: "org",
        baseURL: "https://org-ollama.example.com/v1",
      });
    });

    describe("invalid CUSTOM_AI_BASE_URL warning", () => {
      const BAD = { CUSTOM_AI_BASE_URL: "http://api.llmsrelay.com", CUSTOM_AI_API_KEY: ENV_KEY };
      let warn: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        vi.resetModules();
        warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      });
      afterEach(() => warn.mockRestore());

      it("warns once per process without leaking the URL or key", async () => {
        const fresh = await import("@/lib/ai/provider-resolver");
        fresh.resolveAIProvider({}, BAD, NOW);
        fresh.resolveAIProvider({}, BAD, NOW);
        expect(warn).toHaveBeenCalledTimes(1);
        const message = String(warn.mock.calls[0][0]);
        expect(message).toBe("CUSTOM_AI_BASE_URL is invalid; shared AI fallback disabled");
        expect(message).not.toContain("llmsrelay");
        expect(message).not.toContain(ENV_KEY);
      });

      it("does not warn when the URL is valid or unset", async () => {
        const fresh = await import("@/lib/ai/provider-resolver");
        fresh.resolveAIProvider({}, ENV, NOW);
        fresh.resolveAIProvider({}, {}, NOW);
        fresh.resolveAIProvider({}, { CUSTOM_AI_API_KEY: ENV_KEY }, NOW);
        expect(warn).not.toHaveBeenCalled();
      });
    });

    it("loses to an org custom key, which keeps the org URL and has no env models", () => {
      const org = {
        ai_provider: "custom",
        organization_id: ORG,
        custom_base_url: ORG_BASE,
        custom_api_key: sealCustomApiKey(ORG_KEY, ORG, ORG_BASE),
        custom_model: "org-model",
      };
      expect(resolveAIProvider(org, ENV, NOW)).toEqual({
        provider: "custom",
        source: "org",
        apiKey: ORG_KEY,
        baseURL: ORG_BASE,
      });
      // Also without an explicit choice.
      expect(resolveAIProvider({ ...org, ai_provider: null }, ENV, NOW)).toEqual({
        provider: "custom",
        source: "org",
        apiKey: ORG_KEY,
        baseURL: ORG_BASE,
      });
    });

    it("leaves explicit choices of other providers unchanged", () => {
      expect(resolveAIProvider({ ai_provider: "openai" }, { ...ENV, OPENAI_API_KEY: "sk-oai-env" }, NOW)).toEqual({
        provider: "openai",
        source: "env",
        apiKey: "sk-oai-env",
      });
      expect(
        resolveAIProvider({ ai_provider: "openrouter", openrouter_api_key: "or-key" }, ENV, NOW)
      ).toEqual({ provider: "openrouter", source: "org", apiKey: "or-key" });
      // An explicit provider with no credential falls through to the env fallback.
      expect(resolveAIProvider({ ai_provider: "anthropic" }, ENV, NOW)).toEqual(ENV_RESOLVED);
    });

    describe("SECURITY: the env key only ever goes to the env URL", () => {
      const orgCustomWithoutUsableKey = [
        ["no key", {}],
        ["a plaintext key", { custom_api_key: ORG_KEY }],
        ["a key sealed for another org", { custom_api_key: sealCustomApiKey(ORG_KEY, OTHER_ORG, ORG_BASE) }],
        ["a key sealed for the env URL", { custom_api_key: sealCustomApiKey(ORG_KEY, ORG, ENV_BASE) }],
        ["another sealed secret", { custom_api_key: encrypt(ORG_KEY) }],
      ] as const;

      it.each(orgCustomWithoutUsableKey)(
        "an org choosing custom with its own URL and models but %s gets the env URL and env models",
        (_label, extra) => {
          const settings = {
            ai_provider: "custom",
            organization_id: ORG,
            custom_base_url: ORG_BASE,
            custom_model: "org-model",
            custom_fast_model: "org-fast-model",
            ...extra,
          };
          const resolved = resolveAIProvider(settings, ENV, NOW);
          expect(resolved).toEqual(ENV_RESOLVED);
          expect(resolved?.baseURL).not.toBe(ORG_BASE);
          // Model settings handed to consumers come from env, never the org.
          expect(customModelSettingsFor(resolved!, settings)).toEqual({
            custom_model: "claude-sonnet-4.6",
            custom_fast_model: "claude-haiku-4.5",
          });
        }
      );

      it("never pairs the env key with any other URL across explicit choices", () => {
        const settings = {
          organization_id: ORG,
          custom_base_url: ORG_BASE,
          custom_api_key: ORG_KEY,
          ollama_base_url: "https://ollama.attacker.example.com/v1",
        };
        for (const ai_provider of [...AI_PROVIDER_ORDER, null, "auto"]) {
          const resolved = resolveAIProvider({ ...settings, ai_provider }, ENV, NOW);
          if (resolved?.apiKey === ENV_KEY) {
            expect(resolved.baseURL).toBe(ENV_BASE);
            expect(resolved.source).toBe("env");
          }
          if (resolved?.baseURL === ORG_BASE) expect(resolved.apiKey).not.toBe(ENV_KEY);
        }
      });
    });
  });
});

describe("customModelSettingsFor", () => {
  const orgModels = { custom_model: "org-model", custom_fast_model: "org-fast-model" };

  it("returns the env models for the env custom fallback", () => {
    expect(
      customModelSettingsFor(
        { provider: "custom", source: "env", apiKey: "k", baseURL: "https://a.example.com", model: "m", fastModel: "f" },
        orgModels
      )
    ).toEqual({ custom_model: "m", custom_fast_model: "f" });
    expect(
      customModelSettingsFor({ provider: "custom", source: "env", model: "m", fastModel: "f" }, null)
    ).toEqual({ custom_model: "m", custom_fast_model: "f" });
  });

  it("returns the org settings for an org credential", () => {
    expect(customModelSettingsFor({ provider: "custom", source: "org", apiKey: "k" }, orgModels)).toBe(orgModels);
    expect(customModelSettingsFor({ provider: "anthropic", source: "env", apiKey: "k" }, orgModels)).toBe(orgModels);
  });
});
