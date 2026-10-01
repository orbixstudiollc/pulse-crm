import { beforeEach, describe, expect, it } from 'vitest';

import { FakeStore } from 'src/__tests__/sequences-fakes';
import { generateOpeners } from 'src/gtm/sequences/generate-openers';
import {
  agentOpenerWriter,
  anthropicOpenerWriter,
  ANTHROPIC_MODEL,
  pickOpenerWriter,
} from 'src/gtm/sequences/opener-writers';
import { buildOpenerPrompt, parseOpenerResponse, sanitizeLine } from 'src/gtm/sequences/openers';
import { buildTemplateVariables, renderTemplate } from 'src/gtm/sequences/render-template';

describe('buildOpenerPrompt', () => {
  it('lists the facts it has, fenced as data, with the style', () => {
    const p = buildOpenerPrompt(
      {
        firstName: 'Ada',
        jobTitle: 'CTO',
        company: 'Acme',
        industry: 'Fintech',
        aiSummary: 'Hiring 5 engineers.\n\nRaised a seed.',
        recentPages: ['/pricing', '', '/case-studies'],
        notes: ['Met at SaaStr'],
      },
      'casual',
    );
    expect(p).toContain('Job title: CTO');
    expect(p).toContain('Industry: Fintech');
    expect(p).toContain('Research summary: Hiring 5 engineers. Raised a seed.');
    expect(p).toContain('recently visited on our site: /pricing, /case-studies');
    expect(p).toContain('- Met at SaaStr');
    expect(p).toContain('Style requested by the user: casual');
    expect(p.indexOf('<facts>')).toBeLessThan(p.indexOf('Job title'));
  });

  it('says when there are no facts', () => {
    expect(buildOpenerPrompt({})).toContain('No facts available.');
  });
});

describe('parseOpenerResponse', () => {
  it('reads objects, wrapped results, JSON strings and fenced JSON', () => {
    const expected = { opener: 'Saw Acme is hiring.', firstLine: null, ps: 'P.S. nice site' };
    expect(parseOpenerResponse({ opener: 'Saw Acme is hiring.', ps: 'P.S. nice site' })).toEqual(expected);
    expect(parseOpenerResponse({ result: { opener: 'Saw Acme is hiring.', ps: 'P.S. nice site', firstLine: '' } })).toEqual(
      expected,
    );
    expect(parseOpenerResponse('```json\n{"opener":"Saw Acme is hiring.","ps":"P.S. nice site"}\n```')).toEqual(expected);
  });

  it('falls back to the first line of plain text and cleans it', () => {
    expect(parseOpenerResponse('Opener: "Congrats on the launch."\nmore')).toEqual({
      opener: 'Congrats on the launch.',
      firstLine: null,
      ps: null,
    });
    expect(parseOpenerResponse('')).toBeNull();
    expect(parseOpenerResponse(null)).toBeNull();
    expect(parseOpenerResponse({ foo: 1 })).toBeNull();
  });

  it('caps length', () => {
    expect(sanitizeLine('x'.repeat(500))!.length).toBe(300);
  });
});

describe('template variables for openers and custom values', () => {
  it('uses the opener, first line, P.S., industry and custom keys, with fallbacks', () => {
    const vars = buildTemplateVariables(
      { name: { firstName: 'Ada' }, city: 'Berlin', company: { name: 'Acme', industry: 'Fintech' } },
      { name: 'Sam' },
      new Date('2026-10-01T00:00:00Z'),
      {
        personalizedOpener: 'Saw the Series A news.',
        customPs: 'P.S. loved your talk',
        customVariables: { painPoint: 'slow onboarding', company: 'ACME Corp', 'bad key': 'x', empty: ' ' },
      },
    );
    const t = '{{opener}} {{firstLine}} | {{industry}} {{location}} {{painPoint}} {{company}} {{empty|n/a}} {{ps}}';
    expect(renderTemplate(t, vars).text).toBe(
      'Saw the Series A news. Saw the Series A news. | Fintech Berlin slow onboarding ACME Corp n/a P.S. loved your talk',
    );
    expect(renderTemplate('{{opener|Hope you are well.}}', buildTemplateVariables({})).text).toBe('Hope you are well.');
  });
});

describe('opener writers', () => {
  it('calls the Anthropic Messages API with the configured model', async () => {
    let body: any;
    let headers: any;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      headers = init.headers;
      return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"opener":"Hi"}' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await anthropicOpenerWriter('sk-test', fakeFetch).write('facts');
    expect(out).toBe('{"opener":"Hi"}');
    expect(body.model).toBe(ANTHROPIC_MODEL);
    expect(body.messages).toEqual([{ role: 'user', content: 'facts' }]);
    expect(headers['x-api-key']).toBe('sk-test');
  });

  it('surfaces API errors', async () => {
    const fakeFetch = (async () => new Response('rate limited', { status: 429 })) as unknown as typeof fetch;
    await expect(anthropicOpenerWriter('k', fakeFetch).write('x')).rejects.toThrow('Anthropic API 429: rate limited');
  });

  it('uses the built-in agent without a key', async () => {
    const calls: any[] = [];
    const runAgent = async (input: any) => {
      calls.push(input);
      return { success: true, error: null, result: { opener: 'Hello' } };
    };
    const writer = pickOpenerWriter({ ANTHROPIC_API_KEY: '  ' }, runAgent, 'agent-id');
    expect(await writer.write('p')).toEqual({ opener: 'Hello' });
    expect(calls).toEqual([{ agentUniversalIdentifier: 'agent-id', prompt: 'p' }]);
    const failing = agentOpenerWriter(async () => ({ success: false, error: 'no model', result: null }), 'a');
    await expect(failing.write('p')).rejects.toThrow('no model');
  });
});

describe('generateOpeners', () => {
  let store: FakeStore;
  const prompts: string[] = [];
  const writer = {
    write: async (prompt: string) => {
      prompts.push(prompt);
      return prompt.includes('Bad') ? 'null' : { opener: `Opener ${prompts.length}`, ps: 'P.S.' };
    },
  };

  beforeEach(() => {
    store = new FakeStore();
    prompts.length = 0;
    const base = { sequenceId: 's', status: 'ACTIVE' as const, currentStep: 1, nextSendAt: null };
    store.enrollments.set('e1', { ...base, id: 'e1', personId: 'p1' });
    store.enrollments.set('e2', { ...base, id: 'e2', personId: 'p2', openerStatus: 'APPROVED', personalizedOpener: 'Keep' });
    store.enrollments.set('e3', { ...base, id: 'e3', personId: 'p3', status: 'FINISHED' });
    store.enrollments.set('e4', { ...base, id: 'e4', personId: 'p4' });
    store.contexts.set('p1', { firstName: 'Ada', jobTitle: 'CTO' });
    store.contexts.set('p2', { firstName: 'Bo' });
    store.contexts.set('p3', { firstName: 'Cy' });
    store.contexts.set('p4', { firstName: 'Bad' });
  });

  it('drafts openers for active enrollments and explains every skip', async () => {
    const res = await generateOpeners({
      store,
      writer,
      input: { personIds: ['p1', 'p2', 'p3', 'p4'], style: 'warm' },
    });
    expect(res.drafted).toEqual([{ enrollmentId: 'e1', personId: 'p1', opener: 'Opener 1' }]);
    expect(res.skipped).toEqual(
      expect.arrayContaining([
        { id: 'p3', reason: 'Not in an active sequence' },
        { id: 'e2', reason: 'Opener already approved' },
        { id: 'e4', reason: 'The AI returned no usable opener' },
      ]),
    );
    expect(store.enrollments.get('e1')).toMatchObject({
      personalizedOpener: 'Opener 1',
      customPs: 'P.S.',
      openerStatus: 'DRAFT',
    });
    expect(store.enrollments.get('e2')?.personalizedOpener).toBe('Keep');
    expect(prompts[0]).toContain('Style requested by the user: warm');
  });

  it('targets given enrollments and can redo approved ones', async () => {
    const res = await generateOpeners({
      store,
      writer,
      input: { enrollmentIds: ['e2', 'missing'], overwriteApproved: true },
    });
    expect(res.drafted.map((d) => d.enrollmentId)).toEqual(['e2']);
    expect(res.skipped).toEqual([{ id: 'missing', reason: 'Enrollment not found' }]);
    expect(store.enrollments.get('e2')?.openerStatus).toBe('DRAFT');
  });

  it('requires a target', async () => {
    await expect(generateOpeners({ store, writer, input: {} })).rejects.toThrow();
  });
});
