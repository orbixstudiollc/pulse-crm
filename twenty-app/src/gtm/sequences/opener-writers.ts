// OpenerWriter implementations.
//
// - With an ANTHROPIC_API_KEY app variable: the Anthropic Messages API.
// - Otherwise: Twenty's built-in AI through the app's opener-writer agent
//   (runAgent), which uses the workspace's configured model and billing.

import { OPENER_INSTRUCTIONS, type OpenerWriter } from 'src/gtm/sequences/openers';

export const ANTHROPIC_MODEL = 'claude-sonnet-5-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export const anthropicOpenerWriter = (
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): OpenerWriter => ({
  async write(prompt) {
    const res = await fetchImpl(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        system: OPENER_INSTRUCTIONS,
        messages: [{ role: 'user', content: prompt }],
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
): OpenerWriter => {
  const key = env.ANTHROPIC_API_KEY?.trim();
  return key
    ? anthropicOpenerWriter(key, fetchImpl)
    : agentOpenerWriter(runAgent, agentUniversalIdentifier);
};
