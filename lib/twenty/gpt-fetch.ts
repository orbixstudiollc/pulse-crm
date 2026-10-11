import OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";
import { createTwentyGPTClient, TwentyGPTResponseError } from "./gpt-client";

const RELAY_URL = "https://api.llmsrelay.com";

/** Safe transport classification for Pulse's existing provider fallback policy. */
export class RelayGPTRequestError extends Error {
  constructor(public readonly status: number | undefined, public readonly retryable: boolean) {
    super(`LLMsRelay GPT request failed${status === undefined ? "" : ` (HTTP ${status})`}`);
    this.name = "RelayGPTRequestError";
  }
}

/** Only Relay's GPT models use this bridge; other custom endpoints keep their protocol. */
export function isRelayGPTModel(baseURL: string | undefined, model: string | undefined): boolean {
  return baseURL === RELAY_URL && Boolean(model?.startsWith("gpt-"));
}

/** Keep the existing tool/approval loop while sending only OpenAI requests to Relay. */
export function createRelayGPTFetch(apiKey: string, pinnedFetch: typeof fetch): typeof fetch {
  if (!apiKey?.trim()) throw new Error("Configure the LLMsRelay GPT key first");
  const client = new OpenAI({ apiKey, organization: null, project: null, baseURL: `${RELAY_URL}/v1`, fetch: pinnedFetch, maxRetries: 0, timeout: 60_000 });
  return async (input, init) => {
    const request = new Request(input, init);
    if (request.url !== `${RELAY_URL}/v1/messages` || request.method !== "POST") {
      throw new Error("Invalid LLMsRelay GPT request");
    }
    let params: Anthropic.MessageCreateParamsNonStreaming;
    try {
      const parsed: unknown = await request.json();
      const body = parsed as { model?: unknown; stream?: unknown } | null;
      if (!body || typeof body !== "object" || typeof body.model !== "string" || !isRelayGPTModel(RELAY_URL, body.model) || body.stream === true) {
        throw new Error("Invalid request");
      }
      params = parsed as Anthropic.MessageCreateParamsNonStreaming;
    } catch {
      throw new Error("Invalid LLMsRelay GPT request");
    }
    try {
      const response = await createTwentyGPTClient(client, request.signal).messages.create(params);
      // The AI SDK accepts an array here; the Anthropic SDK's Message type permits null.
      return Response.json({ ...response, content: response.content.map(block => block.type === "text" && block.citations === null ? { ...block, citations: [] } : block) });
    } catch (error) {
      if (error instanceof TwentyGPTResponseError) throw error;
      // Never expose a gateway body, header or echoed credential through SDK errors.
      const status = error instanceof OpenAI.APIError ? error.status : undefined;
      const retryable = error instanceof OpenAI.APIConnectionError || (status !== undefined && [401, 403, 404, 429, 500, 502, 503, 504].includes(status));
      throw new RelayGPTRequestError(status, retryable);
    }
  };
}
