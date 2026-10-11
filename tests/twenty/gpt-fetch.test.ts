import { afterEach, describe, expect, it, vi } from "vitest";
import { createRelayGPTFetch, isRelayGPTModel, RelayGPTRequestError } from "@/lib/twenty/gpt-fetch";

const MODEL = "gpt-6.1-sol";
const URL = "https://api.llmsrelay.com/v1/messages";
const params = { model: MODEL, max_tokens: 100, messages: [{ role: "user", content: "Summarize this lead" }] };
const completion = { id: "chat-1", object: "chat.completion", created: 1, model: MODEL,
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Summary" } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };

afterEach(() => vi.unstubAllEnvs());

describe("Relay GPT fetch bridge", () => {
  it("uses only the fixed Relay origin and a GPT model", () => {
    expect(isRelayGPTModel("https://api.llmsrelay.com", MODEL)).toBe(true);
    expect(isRelayGPTModel("https://api.llmsrelay.com.evil.test", MODEL)).toBe(false);
    expect(isRelayGPTModel("https://api.llmsrelay.com", "claude-sonnet-4.6")).toBe(false);
    expect(() => createRelayGPTFetch("", vi.fn())).toThrow("key");
  });

  it("sends a non-streaming GPT request with only the resolved Bearer key", async () => {
    vi.stubEnv("OPENAI_ORG_ID", "unrelated-account");
    vi.stubEnv("OPENAI_PROJECT_ID", "unrelated-project");
    let outgoing: Request | undefined;
    const raw = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      outgoing = new Request(input, init);
      return Response.json(completion);
    });
    const bridge = createRelayGPTFetch("relay-test-key", raw);
    const response = await bridge(URL, { method: "POST", headers: { "x-api-key": "unrelated-key", "anthropic-version": "2023-06-01" }, body: JSON.stringify(params) });
    expect(outgoing!.url).toBe("https://api.llmsrelay.com/v1/chat/completions");
    expect(outgoing!.headers.get("authorization")).toBe("Bearer relay-test-key");
    expect(outgoing!.headers.has("x-api-key")).toBe(false);
    expect(outgoing!.headers.has("anthropic-version")).toBe(false);
    expect(outgoing!.headers.has("openai-organization")).toBe(false);
    expect(outgoing!.headers.has("openai-project")).toBe(false);
    expect(await outgoing!.json()).toMatchObject({ model: MODEL, stream: false });
    expect(await response.json()).toMatchObject({ type: "message", model: MODEL, content: [{ type: "text", text: "Summary" }], usage: { input_tokens: 10, output_tokens: 5 } });
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["https://other.test/v1/messages", { method: "POST", body: JSON.stringify(params) }],
    ["https://api.llmsrelay.com/v1/models", { method: "GET" }],
    [URL, { method: "POST", body: "not JSON" }],
    [URL, { method: "POST", body: JSON.stringify({ ...params, stream: true }) }],
    [URL, { method: "POST", body: JSON.stringify({ ...params, model: "claude-sonnet-4.6" }) }],
  ] as const)("rejects unsupported requests before reaching any provider", async (url, init) => {
    const raw = vi.fn();
    await expect(createRelayGPTFetch("relay-test-key", raw)(url, init)).rejects.toThrow("Invalid LLMsRelay GPT request");
    expect(raw).not.toHaveBeenCalled();
  });

  it("propagates aborts to the pinned GPT request", async () => {
    const controller = new AbortController();
    let outgoing: Request | undefined;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const raw = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      outgoing = new Request(input, init);
      entered();
      return new Promise<Response>((_resolve, reject) => outgoing!.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
    });
    const pending = createRelayGPTFetch("relay-test-key", raw)(URL, { method: "POST", signal: controller.signal, body: JSON.stringify(params) });
    const rejected = expect(pending).rejects.toThrow("LLMsRelay GPT request failed");
    await started;
    controller.abort();
    await rejected;
    expect(outgoing!.signal.aborted).toBe(true);
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it("redacts provider errors and never retries or falls back", async () => {
    const raw = vi.fn(async () => new Response("relay-test-key reflected in gateway error", { status: 503 }));
    const bridge = createRelayGPTFetch("relay-test-key", raw);
    await expect(bridge(URL, { method: "POST", body: JSON.stringify(params) })).rejects.toMatchObject({ name: "RelayGPTRequestError", message: "LLMsRelay GPT request failed (HTTP 503)", status: 503, retryable: true });
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it("retains safe classification without treating request validation as retryable", async () => {
    const raw = vi.fn();
    const error = await createRelayGPTFetch("relay-test-key", raw)(URL, { method: "POST", body: JSON.stringify({ ...params, messages: [] }) }).catch(error => error);
    expect(error).toBeInstanceOf(RelayGPTRequestError);
    expect(error.retryable).toBe(false);
    expect(raw).not.toHaveBeenCalled();
  });
});
