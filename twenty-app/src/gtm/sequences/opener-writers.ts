// OpenerWriter implementations, chosen by the AI_PROVIDER app variable:
// - anthropic: the Anthropic Messages API.
// - openai / openai-compatible: any Chat Completions API (OpenAI, OpenRouter,
//   Groq, Together, Mistral, Gemini's OpenAI endpoint, local Ollama, ...).
// - twenty (only when chosen): Twenty's built-in AI through the app's
//   opener-writer agent (runAgent), billed as Twenty credits.
// Nothing set is an error, so no AI step falls back to Twenty's credits.

import { OPENER_INSTRUCTIONS, type OpenerWriter } from 'src/gtm/sequences/openers';

export const ANTHROPIC_MODEL = 'claude-sonnet-5-5';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

export const OPENAI_MODEL = 'gpt-4.1';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export const AI_PROVIDERS = ['twenty', 'anthropic', 'openai', 'openai-compatible'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const NO_AI_PROVIDER =
  'No AI provider set. In the Pulse app variables set AI provider to openai-compatible, AI base URL to https://api.llmsrelay.com/v1 and your llmsrelay AI API key, then pick a model on the Setup page.';

/** The provider from the variables: a key alone means Anthropic; nothing set is an error. */
export const resolveProvider = (env: Record<string, string | undefined>): AiProvider => {
  const raw = env.AI_PROVIDER?.trim().toLowerCase();
  if (raw && !(AI_PROVIDERS as readonly string[]).includes(raw)) {
    throw new Error(`Unknown AI provider "${raw}". Use one of: ${AI_PROVIDERS.join(', ')}.`);
  }
  if (raw) return raw as AiProvider;
  if (env.AI_API_KEY?.trim()) return 'anthropic';
  throw new Error(NO_AI_PROVIDER);
};

// Lets other features (reply triage) reuse the provider plumbing with their own
// instructions. Defaults keep the opener behaviour.
export type WriterPrompt = { system?: string; maxTokens?: number };
const DEFAULT_PROMPT: Required<WriterPrompt> = { system: OPENER_INSTRUCTIONS, maxTokens: 400 };

export const anthropicOpenerWriter = (
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  model: string = ANTHROPIC_MODEL,
  baseUrl: string = ANTHROPIC_BASE_URL,
  prompt: WriterPrompt = {},
): OpenerWriter => ({
  async write(userPrompt) {
    const res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: prompt.maxTokens ?? DEFAULT_PROMPT.maxTokens,
        system: prompt.system ?? DEFAULT_PROMPT.system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new Error(`Anthropic API ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
  },
});

export const chatCompletionsOpenerWriter = (
  options: { baseUrl: string; model: string; apiKey?: string },
  fetchImpl: typeof fetch = fetch,
  prompt: WriterPrompt = {},
): OpenerWriter => ({
  async write(userPrompt) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;
    const res = await fetchImpl(`${options.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model,
        max_tokens: prompt.maxTokens ?? DEFAULT_PROMPT.maxTokens,
        messages: [
          { role: 'system', content: prompt.system ?? DEFAULT_PROMPT.system },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new Error(`AI API ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  },
});

type RunAgent = (input: {
  agentUniversalIdentifier: string;
  prompt: string;
}) => Promise<{ result: object | null; error: string | null; success: boolean }>;

export const agentOpenerWriter = (runAgent: RunAgent, agentUniversalIdentifier: string): OpenerWriter => ({
  async write(prompt) {
    const res = await runAgent({ agentUniversalIdentifier, prompt });
    if (!res.success) throw new Error(res.error ?? 'Opener agent failed');
    return res.result;
  },
});

export const pickOpenerWriter = (
  env: Record<string, string | undefined>,
  runAgent: RunAgent,
  agentUniversalIdentifier: string,
  fetchImpl?: typeof fetch,
  prompt: WriterPrompt = {},
): OpenerWriter => {
  const key = env.AI_API_KEY?.trim() || undefined;
  const model = env.AI_MODEL?.trim() || undefined;
  const baseUrl = env.AI_BASE_URL?.trim() || undefined;
  const provider = resolveProvider(env);

  switch (provider) {
    case 'anthropic':
      if (!key) throw new Error('AI provider anthropic needs an AI API key.');
      return anthropicOpenerWriter(key, fetchImpl, model ?? ANTHROPIC_MODEL, baseUrl ?? ANTHROPIC_BASE_URL, prompt);
    case 'openai':
      if (!key) throw new Error('AI provider openai needs an AI API key.');
      return chatCompletionsOpenerWriter(
        { baseUrl: baseUrl ?? OPENAI_BASE_URL, model: model ?? OPENAI_MODEL, apiKey: key },
        fetchImpl,
        prompt,
      );
    case 'openai-compatible':
      if (!baseUrl || !model) throw new Error('AI provider openai-compatible needs an AI base URL and an AI model.');
      return chatCompletionsOpenerWriter({ baseUrl, model, apiKey: key }, fetchImpl, prompt);
    default:
      return agentOpenerWriter(runAgent, agentUniversalIdentifier);
  }
};
