import { beforeEach, describe, expect, it, vi } from "vitest";
import { sealCustomApiKey } from "@/lib/ai/custom-provider";
import { resolveTwentyRelay, validateTwentyRelayModels } from "@/lib/twenty/relay";

beforeEach(() => { vi.stubEnv("ENCRYPTION_KEY", "test-key"); });
const env = { CUSTOM_AI_BASE_URL: "https://api.llmsrelay.com", CUSTOM_AI_API_KEY: "relay-secret", CUSTOM_AI_MODEL: "gpt-6.1-sol", CUSTOM_AI_FAST_MODEL: "gpt-5.6-sol", ANTHROPIC_API_KEY: "different-provider" };
describe("forced LLMsRelay routing", () => {
  it("uses explicit relay endpoint, key and both models only", () => {
    expect(resolveTwentyRelay({}, env)).toMatchObject({ provider: "custom", source: "env", apiKey: "relay-secret", model: "gpt-6.1-sol", fastModel: "gpt-5.6-sol" });
    expect(() => resolveTwentyRelay({}, { ANTHROPIC_API_KEY: "different-provider" })).toThrow("Configure");
    expect(() => resolveTwentyRelay({}, { ...env, CUSTOM_AI_FAST_MODEL: "" })).toThrow("fast model");
    expect(() => resolveTwentyRelay({}, { ...env, CUSTOM_AI_MODEL: "claude-sonnet-4.6" })).toThrow("GPT models");
  });
  it("does not fall back from partial or invalid organization settings", () => {
    expect(() => resolveTwentyRelay({ custom_model: "tenant-main" }, env)).toThrow();
    expect(() => resolveTwentyRelay({}, { ...env, CUSTOM_AI_BASE_URL: "https://api.anthropic.com" })).toThrow("requires");
    expect(() => resolveTwentyRelay({}, { ...env, CUSTOM_AI_BASE_URL: "https://api.llmsrelay.com.evil.test" })).toThrow("requires");
  });
  it("never combines a tenant endpoint or model with the shared key", () => {
    const settings = { organization_id: "org", custom_base_url: "https://api.llmsrelay.com", custom_api_key: sealCustomApiKey("tenant-key", "org", "https://api.llmsrelay.com"), custom_model: "gpt-tenant-main", custom_fast_model: "gpt-tenant-fast" };
    expect(resolveTwentyRelay(settings, env)).toMatchObject({ source: "org", apiKey: "tenant-key", model: "gpt-tenant-main", fastModel: "gpt-tenant-fast" });
    expect(() => resolveTwentyRelay({ ...settings, organization_id: "wrong" }, env)).toThrow();
  });
  it("verifies both models against the authenticated key-specific catalog", async () => {
    const request = vi.fn(async (_input, init) => {
      expect(init?.headers).toEqual({ authorization: "Bearer relay-secret", accept: "application/json" });
      expect(init?.redirect).toBe("manual");
      return new Response(JSON.stringify({ data: [{ id: "gpt-6.1-sol" }, { id: "gpt-5.6-sol" }] }));
    }) as unknown as typeof fetch;
    await expect(validateTwentyRelayModels(resolveTwentyRelay({}, env), request)).resolves.toEqual(["gpt-6.1-sol", "gpt-5.6-sol"]);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects missing models, malformed catalogs and authentication failures without key leakage", async () => {
    const provider = resolveTwentyRelay({}, env);
    await expect(validateTwentyRelayModels(provider, vi.fn(async () => new Response('{"data":[{"id":"gpt-6.1-sol"}]}')) as unknown as typeof fetch)).rejects.toThrow("unavailable");
    await expect(validateTwentyRelayModels(provider, vi.fn(async () => new Response("not-json")) as unknown as typeof fetch)).rejects.toThrow("verify");
    await expect(validateTwentyRelayModels(provider, vi.fn(async () => new Response("relay-secret", { status: 401 })) as unknown as typeof fetch)).rejects.toThrow("HTTP 401");
  });
});
