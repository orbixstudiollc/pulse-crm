import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { AIMessagesClient } from "@/lib/ai/client";

export type TwentyGPTUsage = Pick<Anthropic.Usage, "input_tokens" | "output_tokens">;

/** A paid response may have trustworthy usage even when its content cannot be used. */
export class TwentyGPTResponseError extends Error {
  constructor(public readonly usage: TwentyGPTUsage | null) {
    super("LLMsRelay returned an invalid GPT response");
    this.name = "TwentyGPTResponseError";
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 100) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => jsonValue(item, depth + 1));
  return object(value) && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(item => jsonValue(item, depth + 1));
}
function invalidRequest(): never { throw new Error("Invalid Twenty GPT request"); }
function textBlocks(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return invalidRequest();
  return content.map(block => {
    if (!object(block) || block.type !== "text" || typeof block.text !== "string") return invalidRequest();
    return block.text;
  }).join("");
}

function requestFor(params: Anthropic.MessageCreateParamsNonStreaming): OpenAI.ChatCompletionCreateParamsNonStreaming {
  if (!nonempty(params.model) || !Number.isSafeInteger(params.max_tokens) || params.max_tokens <= 0 || params.stream || !Array.isArray(params.messages) || params.messages.length === 0) invalidRequest();
  if (params.thinking || params.output_config || params.container || params.top_k !== undefined || params.inference_geo) invalidRequest();
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (params.system !== undefined) messages.push({ role: "system", content: textBlocks(params.system) });
  const usedIds = new Set<string>();
  const pendingIds = new Set<string>();
  for (const message of params.messages) {
    if (message.role !== "user" && message.role !== "assistant") invalidRequest();
    if (typeof message.content === "string") {
      if (pendingIds.size) invalidRequest();
      messages.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) invalidRequest();
    const texts: string[] = [];
    const calls: OpenAI.ChatCompletionMessageFunctionToolCall[] = [];
    const results: OpenAI.ChatCompletionToolMessageParam[] = [];
    if (message.role === "assistant" && pendingIds.size) invalidRequest();
    for (const block of message.content) {
      if (block.type === "text") {
        if (typeof block.text !== "string") invalidRequest();
        texts.push(block.text);
      } else if (block.type === "tool_use" && message.role === "assistant") {
        if (!nonempty(block.id) || !nonempty(block.name) || usedIds.has(block.id) || !object(block.input) || !jsonValue(block.input)) invalidRequest();
        usedIds.add(block.id); pendingIds.add(block.id);
        calls.push({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input) } });
      } else if (block.type === "tool_result" && message.role === "user") {
        if (!nonempty(block.tool_use_id) || !pendingIds.delete(block.tool_use_id) || (block.is_error !== undefined && typeof block.is_error !== "boolean")) invalidRequest();
        const content = block.content === undefined ? "" : textBlocks(block.content);
        results.push({ role: "tool", tool_call_id: block.tool_use_id, content: block.is_error ? JSON.stringify({ is_error: true, content }) : content });
      } else invalidRequest();
    }
    if (message.role === "assistant") {
      if (!texts.length && !calls.length) invalidRequest();
      messages.push({ role: "assistant", content: texts.length ? texts.join("") : null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      if (pendingIds.size) invalidRequest();
      // OpenAI requires every tool result before the next ordinary user message.
      messages.push(...results);
      if (texts.length || !results.length) messages.push({ role: "user", content: texts.join("") });
    }
  }
  if (pendingIds.size) invalidRequest();
  const toolNames = new Set<string>();
  const tools: OpenAI.ChatCompletionTool[] | undefined = params.tools?.map(tool => {
    if (!("input_schema" in tool) || (tool.type !== undefined && tool.type !== "custom") || !nonempty(tool.name) || toolNames.has(tool.name) || !object(tool.input_schema) || tool.input_schema.type !== "object" || !jsonValue(tool.input_schema) || (tool.description !== undefined && typeof tool.description !== "string") || (tool.strict !== undefined && typeof tool.strict !== "boolean")) return invalidRequest();
    toolNames.add(tool.name);
    return { type: "function", function: { name: tool.name, parameters: tool.input_schema, ...(tool.description !== undefined ? { description: tool.description } : {}), ...(tool.strict !== undefined ? { strict: tool.strict } : {}) } };
  });
  let toolChoice: OpenAI.ChatCompletionToolChoiceOption | undefined;
  if (params.tool_choice) {
    const choice = params.tool_choice;
    if (choice.type === "tool") {
      if (!toolNames.has(choice.name)) invalidRequest();
      toolChoice = { type: "function", function: { name: choice.name } };
    } else if (choice.type === "any") toolChoice = "required";
    else if (choice.type === "auto" || choice.type === "none") toolChoice = choice.type;
    else invalidRequest();
    if (!tools?.length && choice.type !== "none") invalidRequest();
  }
  const parallel = params.tool_choice && "disable_parallel_tool_use" in params.tool_choice ? params.tool_choice.disable_parallel_tool_use : undefined;
  if (parallel !== undefined && typeof parallel !== "boolean") invalidRequest();
  return {
    model: params.model, messages, stream: false, max_completion_tokens: params.max_tokens,
    ...(tools?.length ? { tools } : {}), ...(toolChoice ? { tool_choice: toolChoice } : {}),
    ...(parallel !== undefined ? { parallel_tool_calls: !parallel } : {}),
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params.top_p !== undefined ? { top_p: params.top_p } : {}),
    ...(params.stop_sequences !== undefined ? { stop: params.stop_sequences } : {}),
  };
}

function usageFor(value: unknown): TwentyGPTUsage | null {
  if (!object(value)) return null;
  const valid = (count: unknown): count is number => typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
  if (!valid(value.prompt_tokens) || !valid(value.completion_tokens) || !valid(value.total_tokens) || value.total_tokens !== value.prompt_tokens + value.completion_tokens) return null;
  for (const [details, total] of [[value.prompt_tokens_details, value.prompt_tokens], [value.completion_tokens_details, value.completion_tokens]] as const) {
    if (details === undefined) continue;
    if (!object(details) || Object.values(details).some(count => !valid(count) || count > total)) return null;
  }
  // completion_tokens already includes reasoning and rejected prediction tokens.
  return { input_tokens: value.prompt_tokens, output_tokens: value.completion_tokens };
}

function responseFor(response: unknown, params: Anthropic.MessageCreateParamsNonStreaming): Anthropic.Message {
  const usage = object(response) ? usageFor(response.usage) : null;
  const invalid = (): never => { throw new TwentyGPTResponseError(usage); };
  if (!object(response) || !usage || !nonempty(response.id) || response.model !== params.model || !Array.isArray(response.choices) || response.choices.length !== 1) return invalid();
  const choice = response.choices[0];
  if (!object(choice) || choice.index !== 0 || !object(choice.message) || choice.message.role !== "assistant") return invalid();
  const message = choice.message;
  if ((message.content !== undefined && message.content !== null && typeof message.content !== "string") || (message.refusal !== undefined && message.refusal !== null && typeof message.refusal !== "string") || (message.function_call !== undefined && message.function_call !== null) || (message.audio !== undefined && message.audio !== null)) return invalid();
  if (!["stop", "length", "tool_calls", "content_filter"].includes(String(choice.finish_reason))) return invalid();
  const calls = message.tool_calls;
  if (calls !== undefined && !Array.isArray(calls)) return invalid();
  const hasCalls = Array.isArray(calls) && calls.length > 0;
  const refused = nonempty(message.refusal) || choice.finish_reason === "content_filter";
  if ((hasCalls && (choice.finish_reason !== "tool_calls" || refused)) || (!hasCalls && choice.finish_reason === "tool_calls")) return invalid();
  const toolChoice = params.tool_choice;
  if (hasCalls && (toolChoice?.type === "none" || (toolChoice && "disable_parallel_tool_use" in toolChoice && toolChoice.disable_parallel_tool_use && calls.length > 1))) return invalid();
  let stopReason: Anthropic.StopReason;
  if (refused) stopReason = "refusal";
  else if (choice.finish_reason === "tool_calls") stopReason = "tool_use";
  else if (choice.finish_reason === "length") stopReason = "max_tokens";
  else if (choice.finish_reason === "stop") stopReason = "end_turn";
  else return invalid();
  if (stopReason === "end_turn" && (toolChoice?.type === "any" || toolChoice?.type === "tool")) return invalid();
  const content: Anthropic.ContentBlock[] = [];
  if (typeof message.content === "string" && message.content.length) content.push({ type: "text", text: message.content, citations: null });
  if (nonempty(message.refusal)) content.push({ type: "text", text: message.refusal, citations: null });
  const ids = new Set<string>();
  const names = new Set(params.tools?.map(tool => tool.name) ?? []);
  for (const call of (calls ?? []) as unknown[]) {
    if (!object(call) || call.type !== "function" || !nonempty(call.id) || ids.has(call.id) || !object(call.function) || !nonempty(call.function.name) || !names.has(call.function.name) || typeof call.function.arguments !== "string") return invalid();
    if (toolChoice?.type === "tool" && call.function.name !== toolChoice.name) return invalid();
    ids.add(call.id);
    let input: unknown;
    try { input = JSON.parse(call.function.arguments); } catch { return invalid(); }
    if (!object(input) || !jsonValue(input)) return invalid();
    content.push({ type: "tool_use", id: call.id, name: call.function.name, input, caller: { type: "direct" } });
  }
  if (stopReason === "end_turn" && content.length === 0) return invalid();
  return {
    id: response.id, type: "message", role: "assistant", model: params.model, container: null, content,
    stop_reason: stopReason, stop_sequence: null,
    usage: { ...usage, cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null, inference_geo: null, server_tool_use: null, service_tier: null },
  };
}

/** The caller owns the pinned transport; this adapter performs one GPT attempt. */
export function createTwentyGPTClient(client: Pick<OpenAI, "chat">, signal?: AbortSignal): AIMessagesClient {
  return { messages: { create: async params => {
    const request = requestFor(params);
    const response = await client.chat.completions.create(request, { maxRetries: 0, ...(signal ? { signal } : {}) });
    return responseFor(response, params);
  } } };
}
