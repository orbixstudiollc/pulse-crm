// A tool-calling chat model on the user's own AI provider (AI_PROVIDER,
// AI_API_KEY, AI_BASE_URL, AI_MODEL or the picked model): the Anthropic
// Messages API, or any Chat Completions API (OpenAI, OpenRouter, llmsrelay...).

import { ANTHROPIC_MODEL, NO_AI_PROVIDER, OPENAI_MODEL, resolveProvider } from 'src/gtm/sequences/opener-writers';

export type ToolCall = { id: string; name: string; args: Record<string, unknown> };

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

export type ModelTurn = { text: string; toolCalls: ToolCall[] };

export type ChatModel = {
  label: string;
  step(system: string, messages: ChatMessage[], tools: ToolSpec[]): Promise<ModelTurn>;
};

type Env = Record<string, string | undefined>;

const MAX_TOKENS = 2000;

const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const apiError = async (label: string, res: Response) => {
  const detail = (await res.text().catch(() => '')).slice(0, 300);
  return new Error(`${label} ${res.status}${detail ? `: ${detail}` : ''}`);
};

export const anthropicChatModel = (
  options: { apiKey: string; model: string; baseUrl: string },
  fetchImpl: typeof fetch = fetch,
): ChatModel => ({
  label: `anthropic:${options.model}`,
  async step(system, messages, tools) {
    const out: { role: 'user' | 'assistant'; content: unknown[] }[] = [];
    const push = (role: 'user' | 'assistant', block: unknown) => {
      const last = out[out.length - 1];
      if (last?.role === role) last.content.push(block);
      else out.push({ role, content: [block] });
    };
    for (const m of messages) {
      if (m.role === 'user') push('user', { type: 'text', text: m.content });
      else if (m.role === 'tool') push('user', { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content });
      else {
        if (m.content) push('assistant', { type: 'text', text: m.content });
        for (const c of m.toolCalls ?? []) push('assistant', { type: 'tool_use', id: c.id, name: c.name, input: c.args });
      }
    }
    const res = await fetchImpl(`${options.baseUrl.replace(/\/+$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        authorization: `Bearer ${options.apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: MAX_TOKENS,
        system,
        messages: out,
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      }),
    });
    if (!res.ok) throw await apiError('AI API', res);
    const data = (await res.json()) as { content?: { type: string; text?: string; id?: string; name?: string; input?: unknown }[] };
    const blocks = data.content ?? [];
    return {
      text: blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
      toolCalls: blocks
        .filter((b) => b.type === 'tool_use' && b.name)
        .map((b, i) => ({ id: b.id ?? `call_${i}`, name: b.name as string, args: parseArgs(b.input) })),
    };
  },
});

export const chatCompletionsChatModel = (
  options: { baseUrl: string; model: string; apiKey?: string },
  fetchImpl: typeof fetch = fetch,
): ChatModel => ({
  label: options.model,
  async step(system, messages, tools) {
    const body = {
      model: options.model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => {
          if (m.role === 'user') return { role: 'user', content: m.content };
          if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
          return {
            role: 'assistant',
            content: m.content || null,
            ...(m.toolCalls?.length
              ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
              : {}),
          };
        }),
      ],
      tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
    };
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;
    const res = await fetchImpl(`${options.baseUrl.replace(/\/+$/, '')}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw await apiError('AI API', res);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: unknown } }[] } }[];
    };
    const message = data.choices?.[0]?.message;
    return {
      text: message?.content ?? '',
      toolCalls: (message?.tool_calls ?? [])
        .filter((c) => c.function?.name)
        .map((c, i) => ({ id: c.id ?? `call_${i}`, name: c.function?.name as string, args: parseArgs(c.function?.arguments) })),
    };
  },
});

/** The chat model from the app variables. Twenty's own AI is not used here: the point is to run on your own provider. */
export const pickChatModel = (env: Env, fetchImpl?: typeof fetch): ChatModel => {
  const key = env.AI_API_KEY?.trim() || undefined;
  const model = env.AI_MODEL?.trim() || undefined;
  const baseUrl = env.AI_BASE_URL?.trim() || undefined;
  const provider = resolveProvider(env);
  switch (provider) {
    case 'anthropic':
      if (!key) throw new Error('AI provider anthropic needs an AI API key.');
      return anthropicChatModel({ apiKey: key, model: model ?? ANTHROPIC_MODEL, baseUrl: baseUrl ?? 'https://api.anthropic.com/v1' }, fetchImpl);
    case 'openai':
      if (!key) throw new Error('AI provider openai needs an AI API key.');
      return chatCompletionsChatModel({ baseUrl: baseUrl ?? 'https://api.openai.com/v1', model: model ?? OPENAI_MODEL, apiKey: key }, fetchImpl);
    case 'openai-compatible':
      if (!baseUrl || !model) throw new Error('AI provider openai-compatible needs an AI base URL and an AI model.');
      return chatCompletionsChatModel({ baseUrl, model, apiKey: key }, fetchImpl);
    default:
      throw new Error(`Pulse chat runs on your own AI, not Twenty's. ${NO_AI_PROVIDER}`);
  }
};
