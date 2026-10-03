import { describe, expect, it } from 'vitest';

import {
  followUpAt,
  replySubject,
  threadableMessageId,
  triageReply,
  type ReplyItem,
  type ReplyItemPatch,
  type ReplyPerson,
  type ReplyStore,
} from 'src/gtm/replies/triage';
import type { EnrollmentRecord, NewTask } from 'src/gtm/sequences/store';
import type { OutboundEmail, OutreachMailer } from 'src/gtm/sequences/transport';

const NOW = new Date('2026-10-03T12:00:00Z');

class FakeReplyStore implements ReplyStore {
  items = new Map<string, ReplyItem>();
  people = new Map<string, ReplyPerson>();
  enrollments = new Map<string, EnrollmentRecord>();
  patches: { id: string; patch: ReplyItemPatch }[] = [];
  tasks: NewTask[] = [];
  opportunities: { id: string; name: string; personId: string; companyId: string | null }[] = [];
  campaignStats: Record<string, Record<string, number>> = {};
  variantStats: Record<string, Record<string, number>> = {};
  fullText: string | null = null;

  async getInboxItem(id: string) { return this.items.get(id) ?? null; }
  async getFullText() { return this.fullText; }
  async getPerson(id: string) { return this.people.get(id) ?? null; }
  async updateInboxItem(id: string, patch: ReplyItemPatch) { this.patches.push({ id, patch }); }
  async findOpenOpportunity(personId: string, companyId: string | null) {
    return this.opportunities.find((o) => o.personId === personId || (companyId && o.companyId === companyId))?.id ?? null;
  }
  async createOpportunity(data: { name: string; personId: string; companyId: string | null }) {
    const id = `opp-${this.opportunities.length + 1}`;
    this.opportunities.push({ id, ...data });
    return id;
  }
  async setLeadStatus(personId: string, status: any) { this.people.get(personId)!.leadStatus = status; }
  async createTask(t: NewTask) { this.tasks.push(t); return `task-${this.tasks.length}`; }
  async getEnrollmentsByIds(ids: string[]) { return ids.map((id) => this.enrollments.get(id)).filter(Boolean) as EnrollmentRecord[]; }
  async updateEnrollment(id: string, patch: any) { this.enrollments.set(id, { ...this.enrollments.get(id)!, ...patch }); }
  async incrementCampaignStats(id: string, d: Record<string, number | undefined>) {
    const s = (this.campaignStats[id] ??= {});
    for (const [k, v] of Object.entries(d)) s[k] = (s[k] ?? 0) + (v ?? 0);
  }
  async incrementVariantStats(id: string, d: Record<string, number | undefined>) {
    const s = (this.variantStats[id] ??= {});
    for (const [k, v] of Object.entries(d)) s[k] = (s[k] ?? 0) + (v ?? 0);
  }
  async setVariantWinner() {}
}

const setup = (personOverrides: Partial<ReplyPerson> = {}) => {
  const store = new FakeReplyStore();
  store.people.set('p1', {
    id: 'p1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@acme.com', jobTitle: 'CEO',
    leadStatus: 'HOT', companyId: 'c1', companyName: 'Acme', ...personOverrides,
  });
  store.items.set('i1', {
    id: 'i1', kind: 'REPLY', subject: 'Re: quick idea', snippet: 'Sounds interesting', fromEmail: 'ada@acme.com',
    mailboxEmail: 'john@orbixsales.com', messageId: '<abc@mail.acme.com>', personId: 'p1', enrollmentId: 'e1', triagedAt: null,
  });
  store.enrollments.set('e1', {
    id: 'e1', personId: 'p1', sequenceId: 's1', campaignId: 'camp1', lastVariantId: 'v1',
    status: 'REPLIED', currentStep: 2, nextSendAt: null, repliedAt: NOW.toISOString(),
  });
  return store;
};

const writerReturning = (out: object) => {
  const prompts: string[] = [];
  return { prompts, write: async (p: string) => { prompts.push(p); return out; } };
};

const fakeMailer = (ok = true) => {
  const sent: OutboundEmail[] = [];
  const recorded: string[] = [];
  const mailer: OutreachMailer = {
    transport: { send: async (e) => { sent.push(e); return ok ? { ok: true, messageId: 'm' } : { ok: false, error: 'cap', retryable: true }; } },
    mailboxes: { pickMailbox: async () => null },
    usage: { recordSend: async (email) => { recorded.push(email); } },
  };
  return { mailer, sent, recorded };
};

const settings = { bookingLink: 'https://calendly.com/orbixstudio/1hr', autoSend: 'off' as const };

describe('triageReply', () => {
  it('interested: creates a deal, drafts the answer and a task, without sending', async () => {
    const store = setup();
    const writer = writerReturning({ intent: 'INTERESTED', summary: 'Wants a call', draft: 'Great, grab a time: https://calendly.com/orbixstudio/1hr' });
    const { mailer, sent } = fakeMailer();
    const r = await triageReply({ store, writer, inboxItemId: 'i1', settings, mailer, now: NOW });

    expect(r).toMatchObject({ ok: true, intent: 'INTERESTED', opportunityId: 'opp-1', autoSent: false });
    expect(store.opportunities[0]).toMatchObject({ name: 'Acme', personId: 'p1', companyId: 'c1' });
    expect(sent).toHaveLength(0);
    expect(store.tasks[0].title).toBe('Send Ada Lovelace the booking link');
    expect(store.tasks[0].body).toContain('calendly.com/orbixstudio/1hr');
    expect(store.patches[0].patch).toMatchObject({ replyIntent: 'INTERESTED', draftReply: expect.stringContaining('calendly'), autoSentAt: null });
    expect(writer.prompts[0]).toContain('Booking link: https://calendly.com/orbixstudio/1hr');
  });

  it('interested with auto-send: sends from the receiving mailbox, threaded', async () => {
    const store = setup();
    const writer = writerReturning({ intent: 'INTERESTED', summary: 's', draft: 'Pick a time: link' });
    const { mailer, sent, recorded } = fakeMailer();
    const r = await triageReply({ store, writer, inboxItemId: 'i1', settings: { ...settings, autoSend: 'interested' }, mailer, now: NOW });

    expect(r.autoSent).toBe(true);
    expect(sent[0]).toMatchObject({ from: 'john@orbixsales.com', to: 'ada@acme.com', subject: 'Re: quick idea', inReplyToMessageId: '<abc@mail.acme.com>' });
    expect(recorded).toEqual(['john@orbixsales.com']);
    expect(store.patches[0].patch.autoSentAt).toBe(NOW.toISOString());
    expect(store.tasks[0].title).toContain('check they book');
  });

  it('falls back to a task when the auto-send fails', async () => {
    const store = setup();
    const { mailer } = fakeMailer(false);
    const r = await triageReply({ store, writer: writerReturning({ intent: 'INTERESTED', draft: 'x' }), inboxItemId: 'i1', settings: { ...settings, autoSend: 'interested' }, mailer, now: NOW });
    expect(r.autoSent).toBe(false);
    expect(store.tasks[0].title).toContain('Send Ada Lovelace the booking link');
  });

  it('reuses an open deal', async () => {
    const store = setup();
    store.opportunities.push({ id: 'existing', name: 'Acme', personId: 'other', companyId: 'c1' });
    const r = await triageReply({ store, writer: writerReturning({ intent: 'INTERESTED', draft: 'x' }), inboxItemId: 'i1', settings, now: NOW });
    expect(r.opportunityId).toBe('existing');
    expect(store.opportunities).toHaveLength(1);
  });

  it('not now: lead Warm and a follow-up task on their date', async () => {
    const store = setup();
    await triageReply({ store, writer: writerReturning({ intent: 'NOT_NOW', draft: 'Thanks', followUpDate: '2027-01-15' }), inboxItemId: 'i1', settings, now: NOW });
    expect(store.people.get('p1')!.leadStatus).toBe('WARM');
    expect(store.tasks[0].dueAt).toBe('2027-01-15T09:00:00.000Z');
  });

  it('unsubscribe: lead Disqualified, no task, no draft', async () => {
    const store = setup();
    await triageReply({ store, writer: writerReturning({ intent: 'UNSUBSCRIBE', draft: 'bye' }), inboxItemId: 'i1', settings, now: NOW });
    expect(store.people.get('p1')!.leadStatus).toBe('DISQUALIFIED');
    expect(store.tasks).toHaveLength(0);
    expect(store.patches[0].patch.draftReply).toBeNull();
  });

  it('never downgrades a customer', async () => {
    const store = setup({ leadStatus: 'CUSTOMER' });
    await triageReply({ store, writer: writerReturning({ intent: 'NOT_INTERESTED' }), inboxItemId: 'i1', settings, now: NOW });
    expect(store.people.get('p1')!.leadStatus).toBe('CUSTOMER');
  });

  it('wrong person: task to contact the referral', async () => {
    const store = setup();
    await triageReply({ store, writer: writerReturning({ intent: 'WRONG_PERSON', referralName: 'Bo Chen', referralEmail: 'bo@acme.com', draft: 'Thanks' }), inboxItemId: 'i1', settings, now: NOW });
    expect(store.tasks[0].title).toBe('Contact Bo Chen, bo@acme.com (referred by Ada Lovelace)');
    expect(store.people.get('p1')!.leadStatus).toBe('COLD');
  });

  it('out of office: resumes the sequence after they are back and uncounts the reply', async () => {
    const store = setup();
    const r = await triageReply({ store, writer: writerReturning({ intent: 'OUT_OF_OFFICE', followUpDate: '2026-10-10' }), inboxItemId: 'i1', settings, now: NOW });
    expect(r.resumedEnrollmentId).toBe('e1');
    expect(store.enrollments.get('e1')).toMatchObject({ status: 'ACTIVE', nextSendAt: '2026-10-11T09:00:00.000Z', repliedAt: null, currentStep: 2 });
    expect(store.campaignStats.camp1).toEqual({ replied: -1 });
    expect(store.variantStats.v1).toEqual({ replied: -1 });
    expect(store.people.get('p1')!.leadStatus).toBe('WARM');
  });

  it('skips items already triaged, bounces and items without a person', async () => {
    const store = setup();
    store.items.set('i2', { ...store.items.get('i1')!, id: 'i2', triagedAt: NOW.toISOString() });
    store.items.set('i3', { ...store.items.get('i1')!, id: 'i3', kind: 'BOUNCE' });
    store.items.set('i4', { ...store.items.get('i1')!, id: 'i4', personId: null });
    const writer = writerReturning({ intent: 'OTHER' });
    for (const id of ['i2', 'i3', 'i4', 'missing']) {
      expect((await triageReply({ store, writer, inboxItemId: id, settings, now: NOW })).skipped).toBeTruthy();
    }
    expect(writer.prompts).toHaveLength(0);
  });

  it('reports a bad AI answer without changing anything', async () => {
    const store = setup();
    const r = await triageReply({ store, writer: writerReturning({ nonsense: true }), inboxItemId: 'i1', settings, now: NOW });
    expect(r.ok).toBe(false);
    expect(store.patches).toHaveLength(0);
  });

  it('prefers the full email text over the preview', async () => {
    const store = setup();
    store.fullText = 'Full body with the whole question';
    const writer = writerReturning({ intent: 'QUESTION', draft: 'a' });
    await triageReply({ store, writer, inboxItemId: 'i1', settings, now: NOW });
    expect(writer.prompts[0]).toContain('Full body with the whole question');
  });
});

describe('helpers', () => {
  it('followUpAt falls back for missing or past dates', () => {
    expect(followUpAt(null, NOW, 7).toISOString()).toBe('2026-10-10T12:00:00.000Z');
    expect(followUpAt('2020-01-01', NOW, 7).toISOString()).toBe('2026-10-10T12:00:00.000Z');
  });

  it('threads only on real Message-IDs', () => {
    expect(threadableMessageId('abc@x.com')).toBe('<abc@x.com>');
    expect(threadableMessageId('3f2b1c4e-1111-2222-3333-444455556666')).toBeNull();
  });

  it('prefixes Re: once', () => {
    expect(replySubject('Re: hi')).toBe('Re: hi');
    expect(replySubject('hi')).toBe('Re: hi');
    expect(replySubject(null)).toBe('Re: our conversation');
  });
});
