import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { createTwentyGPTClient, TwentyGPTResponseError } from "@/lib/twenty/gpt-client";

const params: Anthropic.MessageCreateParamsNonStreaming = {
  model: "gpt-canonical", max_tokens: 2000, system: [{ type: "text", text: "Sales assistant" }],
  messages: [{ role: "user", content: "Find my leads" }],
  tools: [{ name: "twenty_search", description: "Find sales records", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }],
};
function completion(overrides: Record<string, unknown> = {}) {
  return {
    id: "completion-1", object: "chat.completion", created: 1, model: "gpt-canonical",
    choices: [{ index: 0, message: { role: "assistant", content: "Here are your leads", refusal: null }, finish_reason: "stop" }],
    usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50, completion_tokens_details: { reasoning_tokens: 12 } },
    ...overrides,
  };
}
function setup(response = completion(), status = 200) {
  const request = vi.fn(async () => new Response(JSON.stringify(response), { status, headers: { "content-type": "application/json" } }));
  const sdk = new OpenAI({ apiKey: "test-key", baseURL: "https://api.llmsrelay.com/v1", fetch: request, maxRetries: 3 });
  return { client: createTwentyGPTClient(sdk), request };
}
describe("Twenty GPT adapter", () => {
  it("preserves canonical models, uses Bearer chat completions once, and counts reasoning in completion usage once", async () => {
    const { client, request } = setup();
    const result = await client.messages.create(params);
    expect(result).toMatchObject({ model: "gpt-canonical", stop_reason: "end_turn", usage: { input_tokens: 30, output_tokens: 20 } });
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://api.llmsrelay.com/v1/chat/completions");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-key");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "gpt-canonical", stream: false, max_completion_tokens: 2000, messages: [{ role: "system", content: "Sales assistant" }, { role: "user", content: "Find my leads" }] });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("round-trips multiple tool calls, IDs, JSON arguments and mixed tool results/text", async () => {
    const calls = ["call-1", "call-2"].map((id, index) => ({ id, type: "function", function: { name: "twenty_search", arguments: JSON.stringify({ query: `lead ${index}`, filters: { score: 80 } }) } }));
    const first = setup(completion({ choices: [{ index: 0, message: { role: "assistant", content: "I will search", refusal: null, tool_calls: calls }, finish_reason: "tool_calls" }] }));
    const result = await first.client.messages.create({ ...params, tool_choice: { type: "any", disable_parallel_tool_use: false } });
    expect(result.stop_reason).toBe("tool_use");
    expect(result.content.slice(1)).toMatchObject(calls.map((call, index) => ({ type: "tool_use", id: call.id, name: "twenty_search", input: { query: `lead ${index}`, filters: { score: 80 } } })));
    const firstBody = JSON.parse((first.request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(firstBody).toMatchObject({ tool_choice: "required", parallel_tool_calls: true, tools: [{ type: "function", function: { name: "twenty_search", description: "Find sales records", parameters: (params.tools![0] as Anthropic.Tool).input_schema } }] });
    const second = setup();
    await second.client.messages.create({ ...params, messages: [...params.messages, { role: "assistant", content: result.content }, { role: "user", content: [
      { type: "text", text: "Use these results. " },
      { type: "tool_result", tool_use_id: "call-1", content: [{ type: "text", text: '{"leads":[]}' }] },
      { type: "tool_result", tool_use_id: "call-2", content: "Search failed", is_error: true },
      { type: "text", text: "Summarize them." },
    ] }] });
    const secondBody = JSON.parse((second.request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(secondBody.messages.slice(2)).toEqual([
      { role: "assistant", content: "I will search", tool_calls: calls },
      { role: "tool", tool_call_id: "call-1", content: '{"leads":[]}' },
      { role: "tool", tool_call_id: "call-2", content: JSON.stringify({ is_error: true, content: "Search failed" }) },
      { role: "user", content: "Use these results. Summarize them." },
    ]);
  });

  it("accepts a valid tool response with omitted optional content", async () => {
    const { client } = setup(completion({ choices: [{ index: 0, message: { role: "assistant", tool_calls: [{ id: "call-1", type: "function", function: { name: "twenty_search", arguments: '{"query":"lead"}' } }] }, finish_reason: "tool_calls" }] }));
    const result = await client.messages.create(params);
    expect(result).toMatchObject({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "call-1", name: "twenty_search", input: { query: "lead" } }], usage: { input_tokens: 30, output_tokens: 20 } });
  });

  it.each([undefined, null])("rejects an empty final response with content %j", async (content) => {
    const { client } = setup(completion({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }));
    await expect(client.messages.create(params)).rejects.toMatchObject({ usage: { input_tokens: 30, output_tokens: 20 } });
  });

  it.each([
    [{ type: "auto" }, "auto"], [{ type: "none" }, "none"],
    [{ type: "tool", name: "twenty_search" }, { type: "function", function: { name: "twenty_search" } }],
  ])("maps tool choice %j", async (choice, expected) => {
    const { client, request } = setup(choice.type === "tool" ? completion({ choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "twenty_search", arguments: "{}" } }] }, finish_reason: "tool_calls" }] }) : completion());
    await client.messages.create({ ...params, tool_choice: choice as Anthropic.ToolChoice });
    expect(JSON.parse((request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).tool_choice).toEqual(expected);
  });

  it.each([
    { finish_reason: "length", message: { role: "assistant", content: "Incomplete", refusal: null }, expected: "max_tokens" },
    { finish_reason: "stop", message: { role: "assistant", content: null, refusal: "I cannot help" }, expected: "refusal" },
    { finish_reason: "content_filter", message: { role: "assistant", content: null, refusal: null }, expected: "refusal" },
  ])("preserves terminal reason $expected", async ({ finish_reason, message, expected }) => {
    const { client } = setup(completion({ choices: [{ index: 0, finish_reason, message }] }));
    expect((await client.messages.create(params)).stop_reason).toBe(expected);
  });

  it.each([
    { choices: [] }, { choices: [{ index: 0, message: { role: "user", content: "bad" }, finish_reason: "stop" }] },
    { choices: [{ index: 0, message: { role: "assistant", content: [{ type: "text", text: "bad" }] }, finish_reason: "stop" }] },
    { choices: [{ index: 0, message: { role: "assistant", content: null }, finish_reason: "unknown" }] },
  ])("rejects malformed choices while retaining validated usage", async ({ choices }) => {
    const { client } = setup(completion({ choices }));
    const error = await client.messages.create(params).catch(error => error);
    expect(error).toBeInstanceOf(TwentyGPTResponseError);
    expect(error.usage).toEqual({ input_tokens: 30, output_tokens: 20 });
  });

  it.each(["not-json", "[]", "null", '{"query":']) ("rejects malformed tool arguments %s", async (argumentsValue) => {
    const { client } = setup(completion({ choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "twenty_search", arguments: argumentsValue } }] }, finish_reason: "tool_calls" }] }));
    await expect(client.messages.create(params)).rejects.toMatchObject({ usage: { input_tokens: 30, output_tokens: 20 } });
  });

  it.each([
    { id: "", type: "function", function: { name: "twenty_search", arguments: "{}" } },
    { id: "call-1", type: "custom", custom: { name: "twenty_search", input: "{}" } },
    { id: "call-1", type: "function", function: { name: "arbitrary_endpoint", arguments: "{}" } },
  ])("rejects malformed or undeclared tool calls %j", async (call) => {
    const { client } = setup(completion({ choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: [call] }, finish_reason: "tool_calls" }] }));
    await expect(client.messages.create(params)).rejects.toBeInstanceOf(TwentyGPTResponseError);
  });

  it("rejects duplicate or truncated tool calls and empty tool-call finishes", async () => {
    const call = { id: "call-1", type: "function", function: { name: "twenty_search", arguments: "{}" } };
    for (const [tool_calls, finish_reason] of [[[call, call], "tool_calls"], [[call], "length"], [[], "tool_calls"]] as const) {
      const { client } = setup(completion({ choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls }, finish_reason }] }));
      await expect(client.messages.create(params)).rejects.toBeInstanceOf(TwentyGPTResponseError);
    }
  });

  it.each([
    { choice: { type: "none" }, names: ["twenty_search"] },
    { choice: { type: "tool", name: "twenty_search" }, names: ["twenty_other"] },
    { choice: { type: "auto", disable_parallel_tool_use: true }, names: ["twenty_search", "twenty_other"] },
  ])("rejects provider calls that violate tool choice $choice", async ({ choice, names }) => {
    const tools: Anthropic.Tool[] = [...params.tools as Anthropic.Tool[], { name: "twenty_other", input_schema: { type: "object" } }];
    const calls = names.map((name, index) => ({ id: `call-${index}`, type: "function", function: { name, arguments: "{}" } }));
    const { client } = setup(completion({ choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: calls }, finish_reason: "tool_calls" }] }));
    const error = await client.messages.create({ ...params, tools, tool_choice: choice as Anthropic.ToolChoice }).catch(error => error);
    expect(error).toBeInstanceOf(TwentyGPTResponseError);
    expect(error.usage).toEqual({ input_tokens: 30, output_tokens: 20 });
  });

  it.each([{ type: "any" }, { type: "tool", name: "twenty_search" }])("requires a tool call for a successful required choice %j", async (choice) => {
    const { client } = setup();
    await expect(client.messages.create({ ...params, tool_choice: choice as Anthropic.ToolChoice })).rejects.toMatchObject({ usage: { input_tokens: 30, output_tokens: 20 } });
  });

  it.each([
    { finish_reason: "length", message: { role: "assistant", content: "Incomplete", refusal: null }, expected: "max_tokens" },
    { finish_reason: "stop", message: { role: "assistant", content: null, refusal: "I cannot help" }, expected: "refusal" },
  ])("allows terminal $expected without executing a required tool", async ({ finish_reason, message, expected }) => {
    const { client } = setup(completion({ choices: [{ index: 0, finish_reason, message }] }));
    expect((await client.messages.create({ ...params, tool_choice: { type: "tool", name: "twenty_search", disable_parallel_tool_use: true } })).stop_reason).toBe(expected);
  });

  it.each([undefined, null, {}, { prompt_tokens: -1, completion_tokens: 2, total_tokens: 1 }, { prompt_tokens: 1, completion_tokens: 2, total_tokens: 9 }, { prompt_tokens: 1, completion_tokens: "2", total_tokens: 3 }, { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, completion_tokens_details: { reasoning_tokens: 3 } }])("does not invent usage when usage is invalid: %j", async (usage) => {
    const { client } = setup(completion({ usage }));
    const error = await client.messages.create(params).catch(error => error);
    expect(error).toBeInstanceOf(TwentyGPTResponseError);
    expect(error.usage).toBeNull();
  });

  it("rejects unsupported input blocks, mismatched results and missing results before contacting the relay", async () => {
    const tool: Anthropic.ToolUseBlockParam = { type: "tool_use", id: "call-1", name: "twenty_search", input: {} };
    const invalid: Anthropic.MessageParam[][] = [
      [{ role: "user", content: [{ type: "image", source: { type: "url", url: "https://example.test/image" } }] }],
      [{ role: "user", content: [{ type: "tool_result", tool_use_id: "unknown", content: "result" }] }],
      [{ role: "assistant", content: [tool] }, { role: "user", content: "continue" }],
      [{ role: "assistant", content: [tool] }, { role: "user", content: [{ type: "tool_result", tool_use_id: "call-1", content: "ok" }, { type: "tool_result", tool_use_id: "call-1", content: "again" }] }],
    ];
    const { client, request } = setup();
    for (const messages of invalid) await expect(client.messages.create({ ...params, messages })).rejects.toThrow("Invalid Twenty GPT request");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not retry or fall back on an HTTP error even when its supplied SDK enables retries", async () => {
    const { client, request } = setup(completion(), 429);
    await expect(client.messages.create(params)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects unexpected response models while retaining trustworthy usage", async () => {
    const { client } = setup(completion({ model: "different-model" }));
    await expect(client.messages.create(params)).rejects.toMatchObject({ usage: { input_tokens: 30, output_tokens: 20 } });
  });

  it("forwards the caller's abort signal", async () => {
    const controller = new AbortController(); controller.abort();
    const request = vi.fn();
    const sdk = new OpenAI({ apiKey: "test-key", baseURL: "https://api.llmsrelay.com/v1", fetch: request });
    await expect(createTwentyGPTClient(sdk, controller.signal).messages.create(params)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
