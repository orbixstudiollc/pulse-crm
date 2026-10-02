import { describe, expect, it } from 'vitest';

import { fetchModels, modelListRequest, parseModelList, withPickedModel } from 'src/gtm/sequences/ai-models';

describe('modelListRequest', () => {
  it('uses the base URL and a bearer key for openai-compatible', () => {
    const req = modelListRequest({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'https://api.llmsrelay.com/v1/', AI_API_KEY: 'k' });
    expect(req.url).toBe('https://api.llmsrelay.com/v1/models');
    expect(req.headers.authorization).toBe('Bearer k');
  });

  it('defaults anthropic to its own API with version headers', () => {
    const req = modelListRequest({ AI_API_KEY: 'k' });
    expect(req.url).toBe('https://api.anthropic.com/v1/models');
    expect(req.headers['x-api-key']).toBe('k');
    expect(req.headers['anthropic-version']).toBeDefined();
  });

  it('explains that twenty has no list here', () => {
    expect(() => modelListRequest({})).toThrow(/Settings > AI/);
    expect(() => modelListRequest({ AI_PROVIDER: '' })).toThrow(/Settings > AI/);
  });

  it('needs a base URL for openai-compatible', () => {
    expect(() => modelListRequest({ AI_PROVIDER: 'openai-compatible' })).toThrow(/base URL/);
  });
});

describe('parseModelList', () => {
  it('reads OpenAI and Anthropic shapes, dedupes and sorts', () => {
    expect(
      parseModelList({ data: [{ id: 'gpt-b' }, { id: 'claude-a', display_name: 'Claude A' }, { id: 'gpt-b' }, { nope: 1 }] }),
    ).toEqual([{ id: 'claude-a', name: 'Claude A' }, { id: 'gpt-b' }]);
    expect(parseModelList(['x', 'a'])).toEqual([{ id: 'a' }, { id: 'x' }]);
    expect(parseModelList({ unexpected: true })).toEqual([]);
  });
});

describe('fetchModels', () => {
  it('surfaces provider errors', async () => {
    const fake = (async () => new Response('bad key', { status: 401 })) as unknown as typeof fetch;
    await expect(fetchModels({ AI_PROVIDER: 'openai', AI_API_KEY: 'k' }, fake)).rejects.toThrow(/401.*bad key/);
  });

  it('returns the parsed list', async () => {
    const fake = (async () => new Response(JSON.stringify({ data: [{ id: 'm1' }] }), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchModels({ AI_PROVIDER: 'openai', AI_API_KEY: 'k' }, fake)).resolves.toEqual([{ id: 'm1' }]);
  });
});

describe('withPickedModel', () => {
  it('lets a picked model override AI_MODEL', () => {
    expect(withPickedModel({ AI_MODEL: 'a' }, 'b').AI_MODEL).toBe('b');
    expect(withPickedModel({ AI_MODEL: 'a' }, null).AI_MODEL).toBe('a');
  });
});
