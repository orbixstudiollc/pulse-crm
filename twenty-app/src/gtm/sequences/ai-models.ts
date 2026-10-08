// Fetches the model list from the configured AI provider so the model can be
// picked from a list (the Setup page in the Pulse sidebar) instead of typed by hand.
// The picked model is kept in the app's key-value store and wins over the
// AI_MODEL variable until it is cleared.

import { resolveProvider, type AiProvider } from 'src/gtm/sequences/opener-writers';

export const PICKED_AI_MODEL_KV_KEY = 'ai:pickedModel';

type Env = Record<string, string | undefined>;

const DEFAULT_BASE_URLS: Partial<Record<AiProvider, string>> = {
  anthropic: 'https://api.anthropic.com/v1',
  openai: 'https://api.openai.com/v1',
};

export const resolveAiProvider = (env: Env): AiProvider => resolveProvider(env);

/** The env the opener writer should see: a picked model overrides AI_MODEL. */
export const withPickedModel = (env: Env, picked: string | null | undefined): Env =>
  picked?.trim() ? { ...env, AI_MODEL: picked.trim() } : env;

export type ModelListRequest = { url: string; headers: Record<string, string> };

export const modelListRequest = (env: Env): ModelListRequest => {
  const provider = resolveAiProvider(env);
  if (provider === 'twenty') {
    throw new Error('The twenty provider uses the model from Settings > AI. Set AI provider to anthropic, openai or openai-compatible to pick one here.');
  }
  const key = env.AI_API_KEY?.trim();
  const base = (env.AI_BASE_URL?.trim() || DEFAULT_BASE_URLS[provider])?.replace(/\/+$/, '');
  if (!base) throw new Error('Set the AI base URL first, e.g. https://api.llmsrelay.com/v1.');
  if (provider !== 'openai-compatible' && !key) throw new Error(`AI provider ${provider} needs an AI API key.`);

  const headers: Record<string, string> = { accept: 'application/json' };
  if (provider === 'anthropic') {
    if (key) headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
  }
  // Relays in front of Anthropic usually also accept a bearer token.
  if (key) headers.authorization = `Bearer ${key}`;
  return { url: `${base}/models`, headers };
};

export type ModelOption = { id: string; name?: string };

/** Accepts OpenAI ({data:[{id}]}), Anthropic ({data:[{id,display_name}]}) and bare-array shapes. */
export const parseModelList = (json: unknown): ModelOption[] => {
  const list = Array.isArray(json)
    ? json
    : Array.isArray((json as { data?: unknown })?.data)
      ? (json as { data: unknown[] }).data
      : Array.isArray((json as { models?: unknown })?.models)
        ? (json as { models: unknown[] }).models
        : [];
  const seen = new Set<string>();
  const out: ModelOption[] = [];
  for (const item of list) {
    const id = typeof item === 'string' ? item : (item as { id?: unknown })?.id;
    if (typeof id !== 'string' || !id.trim() || seen.has(id)) continue;
    seen.add(id);
    const rawName = typeof item === 'object' && item ? ((item as { display_name?: unknown; name?: unknown }).display_name ?? (item as { name?: unknown }).name) : undefined;
    out.push(typeof rawName === 'string' && rawName !== id ? { id, name: rawName } : { id });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
};

export const fetchModels = async (env: Env, fetchImpl: typeof fetch = fetch): Promise<ModelOption[]> => {
  const { url, headers } = modelListRequest(env);
  const res = await fetchImpl(url, { headers });
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Model list request failed (${res.status})${body ? `: ${body}` : ''}`);
  }
  return parseModelList(await res.json());
};
