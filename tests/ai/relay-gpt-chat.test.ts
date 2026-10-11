import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnthropic } from "@ai-sdk/anthropic";
import { simulateStreamingMiddleware, stepCountIs, streamText, tool, wrapLanguageModel } from "ai";
import { z } from "zod";
import { createRelayGPTFetch, isRelayGPTModel } from "@/lib/twenty/gpt-fetch";
import type { AISettings } from "@/lib/ai/types";

const BASE = "https://api.llmsrelay.com";
const MODEL = "gpt-main";
const KEY = "relay-offline-test-key";

const h = vi.hoisted(() => ({ fetch: null as unknown as typeof globalThis.fetch, close: vi.fn(), logs: [] as Record<string, unknown>[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createAdminClient: () => ({ from: () => {
    const query = {
      select: () => query, eq: () => query, single: async () => ({ data: null }),
      insert: async (payload: Record<string, unknown>) => { h.logs.push(payload); return { error: null }; },
    };
    return query;
  } }),
}));
vi.mock("@/lib/ai/custom-provider", async original => ({
  ...await original<typeof import("@/lib/ai/custom-provider")>(),
  createCustomFetch: async (base: string) => ({ base, fetch: h.fetch, close: h.close }),
}));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function completion(toolCall = false, args = '{"id":"lead-1"}') {
  return {
    id: "chatcmpl-test", object: "chat.completion", created: 1, model: MODEL,
    choices: [{ index: 0, finish_reason: toolCall ? "tool_calls" : "stop", message: toolCall
      ? { role: "assistant", content: null, tool_calls: [{ id: "call-test", type: "function", function: { name: "lookup", arguments: args } }] }
      : { role: "assistant", content: "Done." } }],
    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
  };
}

function model(fetch: typeof globalThis.fetch) {
  const provider = createAnthropic({ apiKey: KEY, baseURL: `${BASE}/v1`, fetch: createRelayGPTFetch(KEY, fetch) });
  return wrapLanguageModel({ model: provider(MODEL), middleware: simulateStreamingMiddleware() });
}

describe("Relay GPT through the existing Copilot tool loop", () => {
  it("limits protocol routing to GPT models at the fixed Relay URL", () => {
    expect(isRelayGPTModel(BASE, MODEL)).toBe(true);
    expect(isRelayGPTModel("https://other-relay.test", MODEL)).toBe(false);
    expect(isRelayGPTModel(BASE, "claude-sonnet-test")).toBe(false);
    expect(isRelayGPTModel(`${BASE}/other`, MODEL)).toBe(false);
  });

  it("preserves tool IDs, inputs and results using only nonstreaming GPT requests", async () => {
    const seen: Request[] = [];
    const bodies: Record<string, unknown>[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init); seen.push(request);
      const body = await request.json(); bodies.push(body);
      return Response.json(completion(seen.length === 1));
    });
    const execute = vi.fn(async ({ id }: { id: string }) => ({ found: id }));
    const result = streamText({
      model: model(fetch), system: "Use only CRM data.", prompt: "Look up lead-1", maxRetries: 0, maxOutputTokens: 100,
      tools: { lookup: tool({ description: "Look up a lead", inputSchema: z.object({ id: z.string() }), execute }) },
      stopWhen: stepCountIs(3),
    });
    expect(await result.text).toBe("Done.");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toEqual({ id: "lead-1" });
    expect(seen).toHaveLength(2);
    expect(seen.every(request => request.url === `${BASE}/v1/chat/completions`)).toBe(true);
    for (const request of seen) {
      expect(request.headers.get("authorization")).toBe(`Bearer ${KEY}`);
      expect(request.headers.has("x-api-key")).toBe(false);
    }
    expect(bodies.every(body => body.stream !== true && body.model === MODEL)).toBe(true);
    expect(bodies[0].tools).toEqual([expect.objectContaining({ type: "function", function: expect.objectContaining({ name: "lookup" }) })]);
    expect(bodies[1].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "assistant", tool_calls: [expect.objectContaining({ id: "call-test" })] }),
      expect.objectContaining({ role: "tool", tool_call_id: "call-test", content: JSON.stringify({ found: "lead-1" }) }),
    ]));
    expect((await result.totalUsage).inputTokens).toBe(10);
    expect((await result.totalUsage).outputTokens).toBe(6);
  });

  it("keeps proposed writes awaiting approval without executing them", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(completion(true)));
    const execute = vi.fn(async () => "changed");
    const result = streamText({
      model: model(fetch), prompt: "Update a lead", maxRetries: 0, maxOutputTokens: 100,
      tools: { lookup: tool({ inputSchema: z.object({ id: z.string() }), needsApproval: true, execute }) },
      stopWhen: stepCountIs(3),
    });
    const chunks = [];
    for await (const part of result.fullStream) chunks.push(part);
    expect(chunks.some(part => part.type === "tool-approval-request")).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses the GPT bridge from Pulse's shared custom nonstream client", async () => {
    h.fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      expect(request.url).toBe(`${BASE}/v1/chat/completions`);
      expect(request.headers.get("authorization")).toBe(`Bearer ${KEY}`);
      expect((await request.json()).model).toBe(MODEL);
      return Response.json(completion());
    });
    h.close.mockClear();
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient({ provider: "custom", source: "org", apiKey: KEY, baseURL: BASE }, { custom_model: MODEL, custom_fast_model: "gpt-fast" });
    const response = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 100, messages: [{ role: "user", content: "Summarize" }] });
    expect(response.content).toEqual([expect.objectContaining({ type: "text", text: "Done." })]);
    expect(response.usage.input_tokens).toBe(5);
    expect(response.usage.output_tokens).toBe(3);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.close).toHaveBeenCalledTimes(1);
  });

  it("does not retry failed GPT calls from the shared nonstream client", async () => {
    h.fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("upstream failed", { status: 503 }));
    h.close.mockClear();
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient({ provider: "custom", source: "org", apiKey: KEY, baseURL: BASE }, { custom_model: MODEL });
    const failure = await client.messages.create({ model: MODEL, max_tokens: 100, messages: [{ role: "user", content: "Summarize" }] })
      .then(() => null, (error: Error & { cause?: Error }) => error);
    expect(failure?.message).toBe("Connection error.");
    expect(failure?.cause?.message).toBe("LLMsRelay GPT request failed (HTTP 503)");
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.close).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["gateway failure", () => new Response("upstream rejected request", { status: 503 })],
    ["malformed tool arguments", () => Response.json(completion(true, "{"))],
    ["malformed response", () => Response.json({ choices: [] })],
  ] as const)("fails closed on %s without retries or tool execution", async (_name, response) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response());
    const execute = vi.fn(async () => "changed");
    const errors: unknown[] = [];
    const result = streamText({
      model: model(fetch), prompt: "Update a lead", maxRetries: 0, maxOutputTokens: 100,
      tools: { lookup: tool({ inputSchema: z.object({ id: z.string() }), execute }) },
      stopWhen: stepCountIs(3), onError: ({ error }) => { errors.push(error); },
    });
    await result.consumeStream();
    expect(errors).toHaveLength(1);
    expect(execute).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("Pulse fallback after a Relay GPT failure", () => {
  async function setup() {
    for (const name of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "OLLAMA_BASE_URL", "CUSTOM_AI_BASE_URL", "CUSTOM_AI_API_KEY"]) vi.stubEnv(name, "");
    vi.stubEnv("ENCRYPTION_KEY", "offline-encryption-key");
    const { sealCustomApiKey } = await import("@/lib/ai/custom-provider");
    const settings = {
      organization_id: "org-test", ai_provider: "custom", custom_base_url: BASE,
      custom_api_key: sealCustomApiKey(KEY, "org-test", BASE), custom_model: MODEL,
      custom_fast_model: "gpt-fast", api_key: null, openrouter_api_key: null, openai_api_key: "fallback-test-key",
    } as unknown as AISettings;
    h.logs = []; h.close.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fallbackFetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
      expect(request.headers.get("authorization")).toBe("Bearer fallback-test-key");
      return Response.json({ ...completion(), model: "gpt-4o" });
    });
    vi.stubGlobal("fetch", fallbackFetch);
    const { callAIWithFallback } = await import("@/lib/ai/client");
    const invoke = () => callAIWithFallback({ settings, orgId: "org-test", userId: "user-test", feature: "chat",
      createParams: model => ({ model, max_tokens: 100, messages: [{ role: "user", content: "Summarize" }] }),
    });
    return { invoke, fallbackFetch };
  }

  it.each([503, 429, 401, 403, 404])("retains the existing fallback policy for HTTP %s", async status => {
    const { invoke, fallbackFetch } = await setup();
    h.fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ error: { message: `gateway body ${KEY}` } }, { status }));
    const result = await invoke();
    expect(result.provider).toBe("openai");
    expect(result.fallbackUsed).toBe(true);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(fallbackFetch).toHaveBeenCalledTimes(1);
    expect(h.close).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.logs)).not.toContain(KEY);
    expect(JSON.stringify(h.logs)).not.toContain("gateway body");
  });

  it("continues to the next provider after a network failure", async () => {
    const { invoke, fallbackFetch } = await setup();
    h.fetch = vi.fn<typeof globalThis.fetch>(async () => { throw new Error(`fetch failed ${KEY}`); });
    expect((await invoke()).fallbackUsed).toBe(true);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(fallbackFetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.logs)).not.toContain(KEY);
  });

  it.each([
    ["malformed response", () => Response.json({ choices: [] })],
    ["nonretryable HTTP status", () => Response.json({ error: { message: "bad request" } }, { status: 400 })],
  ] as const)("stops on a %s without fallback", async (_name, response) => {
    const { invoke, fallbackFetch } = await setup();
    h.fetch = vi.fn<typeof globalThis.fetch>(async () => response());
    await expect(invoke()).rejects.toThrow("Connection error.");
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(fallbackFetch).not.toHaveBeenCalled();
    expect(h.close).toHaveBeenCalledTimes(1);
  });
});
