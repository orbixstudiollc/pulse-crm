import { describe, expect, it } from 'vitest';

import { buildTriagePrompt, parseTriageResponse } from 'src/gtm/replies/classify';
import { parseAutoSendMode } from 'src/gtm/replies/values';
import { bookingLinkFrom } from 'src/gtm/replies/app-variables';

describe('buildTriagePrompt', () => {
  it('includes the email, facts and booking link', () => {
    const p = buildTriagePrompt({
      subject: 'Re: quick idea',
      text: 'Sounds good, can we talk next week?',
      firstName: 'Ada',
      company: 'Acme',
      bookingLink: 'https://calendly.com/orbixstudio/1hr',
      today: '2026-10-03',
    });
    expect(p).toContain('Booking link: https://calendly.com/orbixstudio/1hr');
    expect(p).toContain('Subject: Re: quick idea');
    expect(p).toContain('can we talk next week?');
    expect(p).toContain('Their company: Acme');
  });

  it('says there is no booking link when none is set', () => {
    expect(buildTriagePrompt({ today: '2026-10-03' })).toContain('Booking link: none');
  });
});

describe('parseTriageResponse', () => {
  it('parses fenced JSON and normalises the intent', () => {
    const t = parseTriageResponse('```json\n{"intent":"not now","summary":"Back in Q1","draft":"Thanks!","followUpDate":"2027-01-10"}\n```');
    expect(t).toMatchObject({ intent: 'NOT_NOW', summary: 'Back in Q1', draft: 'Thanks!', followUpDate: '2027-01-10' });
  });

  it('unwraps agent results', () => {
    expect(parseTriageResponse({ result: { intent: 'INTERESTED', summary: 'Wants a call', draft: 'Great, pick a time' } })?.intent).toBe('INTERESTED');
  });

  it('drops drafts for intents that get no answer', () => {
    expect(parseTriageResponse({ intent: 'UNSUBSCRIBE', draft: 'Sorry to see you go' })?.draft).toBeNull();
  });

  it('rejects unknown intents and garbage', () => {
    expect(parseTriageResponse({ intent: 'MAYBE' })).toBeNull();
    expect(parseTriageResponse('no json here')).toBeNull();
    expect(parseTriageResponse(null)).toBeNull();
  });

  it('keeps only valid dates and emails', () => {
    const t = parseTriageResponse({ intent: 'WRONG_PERSON', followUpDate: 'next week', referralEmail: 'not an email', referralName: 'Bo' });
    expect(t).toMatchObject({ followUpDate: null, referralEmail: null, referralName: 'Bo' });
  });
});

describe('settings', () => {
  it('defaults auto-send to off', () => {
    expect(parseAutoSendMode(undefined)).toBe('off');
    expect(parseAutoSendMode('yes')).toBe('off');
    expect(parseAutoSendMode(' Interested ')).toBe('interested');
  });

  it('accepts only http(s) booking links', () => {
    expect(bookingLinkFrom(' https://calendly.com/orbixstudio/1hr ')).toBe('https://calendly.com/orbixstudio/1hr');
    expect(bookingLinkFrom('calendly.com/x')).toBeNull();
    expect(bookingLinkFrom('')).toBeNull();
  });
});

import { pickOpenerWriter } from 'src/gtm/sequences/opener-writers';
import { OPENER_INSTRUCTIONS } from 'src/gtm/sequences/openers';

describe('pickOpenerWriter prompt override', () => {
  const capture = () => {
    const bodies: any[] = [];
    const fetchImpl = (async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{}' }], choices: [{ message: { content: '{}' } }] }) };
    }) as unknown as typeof fetch;
    return { bodies, fetchImpl };
  };
  const noAgent = async () => ({ result: null, error: 'unused', success: false });

  it('keeps the opener instructions by default', async () => {
    const { bodies, fetchImpl } = capture();
    await pickOpenerWriter({ AI_API_KEY: 'k' }, noAgent, 'agent', fetchImpl).write('hi');
    expect(bodies[0]).toMatchObject({ system: OPENER_INSTRUCTIONS, max_tokens: 400 });
  });

  it('uses the given system prompt and token limit', async () => {
    const { bodies, fetchImpl } = capture();
    await pickOpenerWriter({ AI_PROVIDER: 'openai', AI_API_KEY: 'k' }, noAgent, 'agent', fetchImpl, { system: 'TRIAGE', maxTokens: 700 }).write('hi');
    expect(bodies[0].max_tokens).toBe(700);
    expect(bodies[0].messages[0]).toEqual({ role: 'system', content: 'TRIAGE' });
  });
});
