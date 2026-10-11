import type { AIProviderSettings, ResolvedAIProvider } from "@/lib/ai/provider-resolver";
import { normalizeCustomBaseUrl, openCustomApiKey, createCustomFetch } from "@/lib/ai/custom-provider";
import OpenAI from "openai";
import type { AIMessagesClient } from "@/lib/ai/client";
import { estimateTokens } from "@/lib/ai/shared-budget-core";
import { createTwentyGPTClient, TwentyGPTResponseError } from "./gpt-client";

export const TWENTY_RELAY_URL = "https://api.llmsrelay.com";
export type TwentyRelayProvider = ResolvedAIProvider & { provider: "custom"; apiKey: string; baseURL: typeof TWENTY_RELAY_URL; model: string; fastModel: string };

/** Twenty never enters Pulse's provider fallback chain. Partial org settings fail closed. */
export function resolveTwentyRelay(settings: AIProviderSettings, env: Record<string, string | undefined>): TwentyRelayProvider {
  const orgConfigured = Boolean(settings.custom_base_url || settings.custom_api_key || settings.custom_model || settings.custom_fast_model);
  const rawUrl = orgConfigured ? settings.custom_base_url : env.CUSTOM_AI_BASE_URL;
  const model = (orgConfigured ? settings.custom_model : env.CUSTOM_AI_MODEL)?.trim();
  const fastModel = (orgConfigured ? settings.custom_fast_model : env.CUSTOM_AI_FAST_MODEL)?.trim();
  let base: string;
  try { base = normalizeCustomBaseUrl(rawUrl || ""); } catch { throw new Error("Configure LLMsRelay for Twenty first"); }
  if (base !== TWENTY_RELAY_URL) throw new Error("Twenty AI requires https://api.llmsrelay.com");
  const apiKey = orgConfigured
    ? openCustomApiKey(settings.custom_api_key, settings.organization_id, base)
    : env.CUSTOM_AI_API_KEY?.trim();
  if (!apiKey || !model || !fastModel) throw new Error("Configure the LLMsRelay key, main model, and fast model before using Twenty AI");
  if (!model.startsWith("gpt-") || !fastModel.startsWith("gpt-")) throw new Error("Twenty AI requires GPT models from the LLMsRelay catalog");
  return { provider: "custom", source: orgConfigured ? "org" : "env", apiKey, baseURL: TWENTY_RELAY_URL, model, fastModel };
}

export async function validateTwentyRelayModels(provider: TwentyRelayProvider, injectedFetch?: typeof fetch): Promise<string[]> {
  if (provider.baseURL !== TWENTY_RELAY_URL || !provider.apiKey) throw new Error("Invalid LLMsRelay configuration");
  const pinned = injectedFetch ? { fetch: injectedFetch, close: async () => {} } : await createCustomFetch(TWENTY_RELAY_URL);
  try {
    const response = await pinned.fetch(`${TWENTY_RELAY_URL}/v1/models`, {
      headers: { authorization: `Bearer ${provider.apiKey}`, accept: "application/json" },
      redirect: "manual", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`LLMsRelay model verification failed (HTTP ${response.status})`);
    if (!response.body) throw new Error("LLMsRelay returned an invalid model catalog");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_048_576) { await reader.cancel(); throw new Error("LLMsRelay model catalog is too large"); }
      chunks.push(value);
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { data?: { id?: unknown }[] };
    const models = Array.isArray(parsed.data) ? parsed.data.flatMap(row => typeof row?.id === "string" ? [row.id] : []) : [];
    if (!models.includes(provider.model) || !models.includes(provider.fastModel)) throw new Error("The configured LLMsRelay models are unavailable for this key");
    return models;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("LLMsRelay")) throw error;
    if (error instanceof Error && error.message.startsWith("The configured")) throw error;
    throw new Error("Could not verify the LLMsRelay model catalog");
  } finally { await pinned.close(); }
}

/** One metered attempt only: a timed-out inference must not cause hidden SDK retries. */
export function createTwentyMessagesClient(provider: TwentyRelayProvider, orgId: string): AIMessagesClient {
  return { messages: { create: async params => {
    if (!orgId || provider.baseURL !== TWENTY_RELAY_URL || !provider.apiKey || !params.model.startsWith("gpt-") || ![provider.model, provider.fastModel].includes(params.model)) {
      throw new Error("Invalid Twenty LLMsRelay request");
    }
    const sharedBudget = provider.source === "env" ? await import("@/lib/ai/shared-budget") : null;
    const reservation = sharedBudget
      ? await sharedBudget.reserveSharedTokens(orgId, estimateTokens({ input: JSON.stringify({ system: params.system, messages: params.messages, tools: params.tools }), maxOutputTokens: params.max_tokens }), { isGuest: false })
      : null;
    if (reservation && !reservation.ok) throw new Error(reservation.reason);
    const pinned = await createCustomFetch(TWENTY_RELAY_URL);
    try {
      const client = new OpenAI({ apiKey: provider.apiKey, organization: null, project: null, baseURL: `${TWENTY_RELAY_URL}/v1`, fetch: pinned.fetch, timeout: 60_000, maxRetries: 0 });
      const response = await createTwentyGPTClient(client).messages.create(params);
      if (reservation?.ok && sharedBudget) await sharedBudget.settleSharedTokens(orgId, reservation.day, reservation.reserved, response.usage.input_tokens + response.usage.output_tokens, { isGuest: false });
      return response;
    } catch (error) {
      if (error instanceof TwentyGPTResponseError) {
        if (error.usage && reservation?.ok && sharedBudget) await sharedBudget.settleSharedTokens(orgId, reservation.day, reservation.reserved, error.usage.input_tokens + error.usage.output_tokens, { isGuest: false });
        throw error;
      }
      throw new Error("LLMsRelay GPT request failed");
    } finally { await pinned.close(); }
  } } };
}
