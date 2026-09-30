// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveAIProvider } from "@/lib/ai/provider-resolver";

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
});
