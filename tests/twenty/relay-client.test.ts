import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), close: vi.fn(), reserve: vi.fn(), settle: vi.fn(), pin: vi.fn() }));
vi.mock("@/lib/ai/custom-provider", async (original) => ({
  ...await original<typeof import("@/lib/ai/custom-provider")>(),
  createCustomFetch: mocks.pin,
}));
vi.mock("@/lib/ai/shared-budget", () => ({ reserveSharedTokens: mocks.reserve, settleSharedTokens: mocks.settle }));
import { createTwentyMessagesClient, type TwentyRelayProvider } from "@/lib/twenty/relay";

const provider: TwentyRelayProvider = { provider: "custom", source: "env", apiKey: "relay-test-key", baseURL: "https://api.llmsrelay.com", model: "gpt-6.1-sol", fastModel: "gpt-5.6-sol" };
const params = { model: provider.fastModel, max_tokens: 200, messages: [{ role: "user" as const, content: "Score this lead" }] };
const completion = { id: "chat-1", object: "chat.completion", created: 1, model: provider.fastModel,
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Summary" } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pin.mockResolvedValue({ fetch: mocks.fetch, close: mocks.close });
  mocks.fetch.mockImplementation(async () => Response.json(completion));
  mocks.reserve.mockResolvedValue({ ok: true, day: "2026-10-11", reserved: 250 });
  mocks.settle.mockResolvedValue(undefined);
});

describe("budgeted Twenty GPT client", () => {
  it("reserves before one pinned GPT request and settles actual usage once", async () => {
    const response = await createTwentyMessagesClient(provider, "org").messages.create(params);
    expect(response.usage).toMatchObject({ input_tokens: 10, output_tokens: 5 });
    expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(mocks.fetch.mock.invocationCallOrder[0]);
    expect(mocks.settle).toHaveBeenCalledExactlyOnceWith("org", "2026-10-11", 250, 15, { isGuest: false });
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("https://api.llmsrelay.com/v1/chat/completions");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer relay-test-key");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: provider.fastModel, stream: false, max_completion_tokens: 200 });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("does not call a provider when budget is refused", async () => {
    mocks.reserve.mockResolvedValue({ ok: false, reason: "cap reached" });
    await expect(createTwentyMessagesClient(provider, "org").messages.create(params)).rejects.toThrow("cap reached");
    expect(mocks.pin).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(["wrong-model", "claude-sonnet-4.6"])("rejects an unapproved model before reserving or sending: %s", async (model) => {
    await expect(createTwentyMessagesClient(provider, "org").messages.create({ ...params, model })).rejects.toThrow("Invalid Twenty");
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.pin).not.toHaveBeenCalled();
  });

  it.each([completion.usage, undefined])("settles malformed response usage only when trustworthy: %j", async (usage) => {
    mocks.fetch.mockImplementation(async () => Response.json({ ...completion, choices: [], usage }));
    await expect(createTwentyMessagesClient(provider, "org").messages.create(params)).rejects.toThrow("invalid GPT response");
    if (usage) expect(mocks.settle).toHaveBeenCalledExactlyOnceWith("org", "2026-10-11", 250, 15, { isGuest: false });
    else expect(mocks.settle).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("retains reservations, redacts errors, and never retries a gateway failure", async () => {
    mocks.fetch.mockImplementation(async () => new Response("relay-test-key", { status: 503 }));
    await expect(createTwentyMessagesClient(provider, "org").messages.create(params)).rejects.toThrow(/^LLMsRelay GPT request failed$/);
    expect(mocks.settle).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("leaves shared-budget accounting to its caller for an organization-owned key", async () => {
    await createTwentyMessagesClient({ ...provider, source: "org" }, "org").messages.create(params);
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.settle).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
