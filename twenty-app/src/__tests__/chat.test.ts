import { describe, expect, it } from 'vitest';

import { runChat } from 'src/gtm/chat/agent';
import { anthropicChatModel, chatCompletionsChatModel, pickChatModel, type ChatModel, type ModelTurn } from 'src/gtm/chat/model';
import { chatTools, type PulseActions, type Rest } from 'src/gtm/chat/tools';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const noActions: PulseActions = {
  startIcp: async () => ({ ok: true }),
  findLeads: async () => ({ ok: true }),
  qualifyLeads: async () => ({ ok: true }),
  qualificationStatus: async () => ({ ok: true, counts: { QUALIFIED: 3 } }),
  enrollQualified: async () => ({ ok: true }),
};

const scripted = (turns: ModelTurn[]): ChatModel & { seen: unknown[][] } => {
  const seen: unknown[][] = [];
  return {
    label: 'fake',
    seen,
    step: async (_system, messages) => {
      seen.push(messages.map((m) => ({ ...m })));
      return turns.shift() ?? { text: 'done', toolCalls: [] };
    },
  };
};

describe('pulse chat', () => {
  it('runs tools and feeds results back until the model answers', async () => {
    const calls: string[] = [];
    const rest: Rest = {
      get: async (path, options) => {
        calls.push(`${path} ${JSON.stringify(options?.query ?? {})}`);
        return { data: { people: [{ id: 'p1', name: { firstName: 'Ann' } }] }, totalCount: 1 } as never;
      },
      post: async () => ({}) as never,
      patch: async () => ({}) as never,
    };
    const model = scripted([
      { text: '', toolCalls: [{ id: 'c1', name: 'search_records', args: { object: 'people', filter: 'leadStatus[eq]:HOT', limit: 5 } }] },
      { text: 'Ann is your hottest lead.', toolCalls: [] },
    ]);
    const res = await runChat({ model, tools: chatTools(rest, noActions), history: [{ role: 'user', content: 'hottest lead?' }] });
    expect(res.reply).toBe('Ann is your hottest lead.');
    expect(res.steps).toEqual([{ tool: 'search_records', ok: true, summary: '1 records' }]);
    expect(calls).toEqual(['/rest/people {"limit":5,"filter":"leadStatus[eq]:HOT"}']);
    expect(model.seen[1]).toHaveLength(3);
  });

  it('reports a bad tool call back to the model instead of failing', async () => {
    const model = scripted([
      { text: '', toolCalls: [{ id: 'c1', name: 'get_record', args: { object: '../admin', id: 'x' } }] },
      { text: 'Sorry.', toolCalls: [] },
    ]);
    const res = await runChat({ model, tools: chatTools({} as Rest, noActions), history: [{ role: 'user', content: 'x' }] });
    expect(res.steps[0].ok).toBe(false);
    expect(res.reply).toBe('Sorry.');
  });

  it('has no delete or email tools', () => {
    const names = chatTools({} as Rest, noActions).map((t) => t.name);
    expect(names.some((n) => /delete|send|email/.test(n))).toBe(false);
  });

  it('speaks the Chat Completions tool format (llmsrelay, OpenRouter)', async () => {
    let body: any;
    const f = (async (url: string, init: RequestInit) => {
      expect(url).toBe('https://api.llmsrelay.com/v1/chat/completions');
      body = JSON.parse(String(init.body));
      return json({ choices: [{ message: { content: null, tool_calls: [{ id: 't1', function: { name: 'qualification_status', arguments: '{}' } }] } }] });
    }) as unknown as typeof fetch;
    const model = pickChatModel({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'https://api.llmsrelay.com/v1', AI_MODEL: 'gpt-luna', AI_API_KEY: 'k' }, f);
    const turn = await model.step('sys', [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'a', name: 'list_objects', args: {} }] },
      { role: 'tool', toolCallId: 'a', name: 'list_objects', content: '[]' },
    ], [{ name: 'qualification_status', description: 'd', parameters: { type: 'object', properties: {} } }]);
    expect(turn.toolCalls).toEqual([{ id: 't1', name: 'qualification_status', args: {} }]);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.messages[2].tool_calls[0].function.name).toBe('list_objects');
    expect(body.messages[3]).toEqual({ role: 'tool', tool_call_id: 'a', content: '[]' });
    expect(body.tools[0].type).toBe('function');
    expect(chatCompletionsChatModel).toBeDefined();
  });

  it('speaks the Anthropic tool format and merges tool results into one user turn', async () => {
    let body: any;
    const f = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return json({ content: [{ type: 'text', text: 'ok' }] });
    }) as unknown as typeof fetch;
    const model = anthropicChatModel({ apiKey: 'k', model: 'm', baseUrl: 'https://x/v1' }, f);
    await model.step('sys', [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'a', name: 't', args: {} }, { id: 'b', name: 't', args: {} }] },
      { role: 'tool', toolCallId: 'a', name: 't', content: '1' },
      { role: 'tool', toolCallId: 'b', name: 't', content: '2' },
    ], []);
    expect(body.messages).toHaveLength(3);
    expect(body.messages[2].content.map((c: any) => c.tool_use_id)).toEqual(['a', 'b']);
  });

  it('never runs on Twenty AI by default', () => {
    expect(() => pickChatModel({})).toThrow(/llmsrelay/);
    expect(() => pickChatModel({ AI_PROVIDER: 'twenty' })).toThrow(/own AI/);
  });
});
