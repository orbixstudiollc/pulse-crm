import { beforeEach, describe, expect, it } from 'vitest';

import { enrollPeople } from 'src/gtm/sequences/enroll';
import { markReply } from 'src/gtm/sequences/mark-reply';
import { sendDueSteps } from 'src/gtm/sequences/send-due-steps';
import {
  pickEnrollmentPatch,
  type EnrollmentRecord,
  type NewInboxItem,
  type NewTask,
  type PersonRecord,
  type SequenceRecord,
  type SequenceStore,
} from 'src/gtm/sequences/store';
import type { OutboundEmail, OutreachMailer, SendResult } from 'src/gtm/sequences/transport';

class FakeStore implements SequenceStore {
  enrollments = new Map<string, EnrollmentRecord>();
  sequences = new Map<string, SequenceRecord>();
  people = new Map<string, PersonRecord>();
  campaigns = new Map<string, Record<string, number>>();
  inbox: (NewInboxItem & { id: string })[] = [];
  tasks: NewTask[] = [];
  private seq = 0;

  async findDueEnrollments(now: Date, limit: number) {
    return [...this.enrollments.values()]
      .filter((e) => e.status === 'ACTIVE' && e.nextSendAt && new Date(e.nextSendAt) <= now)
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }
  async findEnrollments(f: { personIds?: string[]; sequenceId?: string; activeOnly?: boolean }) {
    return [...this.enrollments.values()]
      .filter((e) => !f.personIds || f.personIds.includes(e.personId))
      .filter((e) => !f.sequenceId || e.sequenceId === f.sequenceId)
      .filter((e) => !f.activeOnly || e.status === 'ACTIVE')
      .map((e) => ({ ...e }));
  }
  async createEnrollment(data: any) {
    const id = `enr-${++this.seq}`;
    this.enrollments.set(id, { ...data, id });
    return id;
  }
  async updateEnrollment(id: string, patch: any) {
    const e = this.enrollments.get(id);
    if (e) this.enrollments.set(id, { ...e, ...pickEnrollmentPatch(patch) });
  }
  async getSequence(id: string) {
    return this.sequences.get(id) ?? null;
  }
  async getPeople(ids: string[]) {
    return ids.map((id) => this.people.get(id)).filter((p): p is PersonRecord => Boolean(p));
  }
  async findPersonByEmail(email: string) {
    return [...this.people.values()].find((p) => p.emails?.primaryEmail?.toLowerCase() === email) ?? null;
  }
  async setLeadStatus(personId: string, status: any) {
    const p = this.people.get(personId);
    if (p) p.leadStatus = status;
  }
  async incrementCampaignStats(id: string, delta: Record<string, number | undefined>) {
    const c = this.campaigns.get(id) ?? {};
    for (const [k, v] of Object.entries(delta)) c[k] = (c[k] ?? 0) + (v ?? 0);
    this.campaigns.set(id, c);
  }
  async hasInboxItemForMessage(messageId: string) {
    return this.inbox.some((i) => i.messageId === messageId);
  }
  async createInboxItem(data: NewInboxItem) {
    const id = `inbox-${++this.seq}`;
    this.inbox.push({ ...data, id });
    return id;
  }
  async createTask(data: NewTask) {
    this.tasks.push(data);
    return `task-${this.tasks.length}`;
  }
}

class FakeMailer implements OutreachMailer {
  sent: OutboundEmail[] = [];
  usage: { recordSend: (email: string) => Promise<void> };
  recorded: string[] = [];
  nextResult: SendResult = { ok: true, messageId: 'm1' };
  mailbox: string | null = 'sales@pulse.test';
  sender = { name: 'Sam' };
  transport = {
    send: async (email: OutboundEmail) => {
      this.sent.push(email);
      return this.nextResult;
    },
  };
  mailboxes = { pickMailbox: async () => this.mailbox };
  constructor() {
    this.usage = { recordSend: async (email: string) => void this.recorded.push(email) };
  }
}

const NOW = new Date('2026-10-01T09:00:00Z'); // Thursday

let store: FakeStore;
let mailer: FakeMailer;

beforeEach(() => {
  store = new FakeStore();
  mailer = new FakeMailer();
  store.sequences.set('seq-1', {
    id: 'seq-1',
    name: 'Founders',
    status: 'ACTIVE',
    businessDaysOnly: false,
    // Deliberately out of order: steps run by `order`.
    steps: [
      { id: 's2', order: 2, delayDays: 3, type: 'TASK', instructions: 'Call them' },
      {
        id: 's1',
        order: 1,
        delayDays: 0,
        type: 'EMAIL',
        template: { id: 't1', subject: 'Hi {{firstName|there}}', body: 'Hello {{firstName}} at {{company}}' },
      },
      {
        id: 's3',
        order: 3,
        delayDays: 2,
        type: 'EMAIL',
        template: { id: 't2', subject: 'Re: {{company}}', body: 'Bump' },
      },
    ],
  });
  store.people.set('p1', {
    id: 'p1',
    name: { firstName: 'Ada', lastName: 'L' },
    emails: { primaryEmail: 'ada@acme.com' },
    company: { name: 'Acme' },
    leadStatus: 'NEW',
  });
  store.people.set('p2', { id: 'p2', name: { firstName: 'Bo' }, emails: { primaryEmail: '' } });
  store.people.set('p3', {
    id: 'p3',
    name: { firstName: 'Cy' },
    emails: { primaryEmail: 'cy@x.com' },
    leadStatus: 'CUSTOMER',
  });
});

describe('enrollPeople', () => {
  it('enrolls new people, skips the rest with reasons, and counts campaign enrollments', async () => {
    const res = await enrollPeople({
      store,
      input: { personIds: ['p1', 'p2', 'p3', 'missing', 'p1'], sequenceId: 'seq-1', campaignId: 'c1' },
      now: NOW,
    });
    expect(res.enrolled.map((e) => e.personId)).toEqual(['p1']);
    expect(res.enrolled[0].nextSendAt).toBe(NOW.toISOString());
    expect(res.skipped).toEqual([
      { personId: 'p2', reason: 'No email address' },
      { personId: 'p3', reason: 'Lead status is CUSTOMER' },
      { personId: 'missing', reason: 'Person not found' },
    ]);
    expect(store.campaigns.get('c1')).toEqual({ enrolled: 1 });

    const again = await enrollPeople({ store, input: { personIds: ['p1'], sequenceId: 'seq-1' }, now: NOW });
    expect(again.skipped).toEqual([{ personId: 'p1', reason: 'Already enrolled in this sequence' }]);
  });

  it('rejects bad input', async () => {
    await expect(enrollPeople({ store, input: { personIds: [], sequenceId: 'seq-1' } })).rejects.toThrow();
    await expect(enrollPeople({ store, input: { personIds: ['p1'], sequenceId: 'nope' } })).rejects.toThrow(
      'not found',
    );
  });
});

describe('sendDueSteps', () => {
  const enroll = async () => {
    const res = await enrollPeople({
      store,
      input: { personIds: ['p1'], sequenceId: 'seq-1', campaignId: 'c1' },
      now: NOW,
    });
    return res.enrolled[0].enrollmentId;
  };

  it('sends the first email rendered for the person, then schedules the next step', async () => {
    const id = await enroll();
    const summary = await sendDueSteps({ store, mailer: mailer as any, now: NOW });
    expect(summary).toMatchObject({ due: 1, sent: 1, failed: 0 });
    expect(mailer.sent[0]).toMatchObject({
      from: 'sales@pulse.test',
      to: 'ada@acme.com',
      subject: 'Hi Ada',
      text: 'Hello Ada at Acme',
      stepNumber: 1,
    });
    expect(mailer.sent[0].html).toContain('<p>Hello Ada at Acme</p>');
    expect(mailer.recorded).toEqual(['sales@pulse.test']);
    expect(store.enrollments.get(id)).toMatchObject({
      status: 'ACTIVE',
      currentStep: 2,
      mailboxEmail: 'sales@pulse.test',
      nextSendAt: '2026-10-04T09:00:00.000Z',
    });
    expect(store.campaigns.get('c1')).toEqual({ enrolled: 1, sent: 1 });
  });

  it('creates a task for TASK steps, keeps the mailbox, and finishes after the last step', async () => {
    const id = await enroll();
    await sendDueSteps({ store, mailer: mailer as any, now: NOW });
    mailer.mailbox = 'other@pulse.test';

    const day4 = new Date('2026-10-04T09:00:00Z');
    expect(await sendDueSteps({ store, mailer: mailer as any, now: day4 })).toMatchObject({ tasksCreated: 1 });
    expect(store.tasks[0]).toMatchObject({ personId: 'p1', body: 'Call them' });

    const day6 = new Date('2026-10-06T09:00:00Z');
    expect(await sendDueSteps({ store, mailer: mailer as any, now: day6 })).toMatchObject({
      sent: 1,
      finished: 1,
    });
    expect(mailer.sent[1].from).toBe('sales@pulse.test');
    expect(store.enrollments.get(id)).toMatchObject({ status: 'FINISHED', nextSendAt: null });
  });

  it('does nothing before the send time or while the sequence is paused', async () => {
    await enroll();
    expect((await sendDueSteps({ store, mailer: mailer as any, now: new Date('2026-09-30T00:00:00Z') })).due).toBe(0);
    store.sequences.get('seq-1')!.status = 'PAUSED';
    expect(await sendDueSteps({ store, mailer: mailer as any, now: NOW })).toMatchObject({ skipped: 1, sent: 0 });
  });

  it('defers when no mailbox has capacity', async () => {
    const id = await enroll();
    mailer.mailbox = null;
    expect(await sendDueSteps({ store, mailer: mailer as any, now: NOW })).toMatchObject({ deferred: 1, sent: 0 });
    expect(store.enrollments.get(id)?.currentStep).toBe(1);
  });

  it('ends as BOUNCED on a hard bounce and retries temporary failures', async () => {
    const id = await enroll();
    mailer.nextResult = { ok: false, error: '421 try later', retryable: true };
    expect(await sendDueSteps({ store, mailer: mailer as any, now: NOW })).toMatchObject({ deferred: 1 });
    expect(store.enrollments.get(id)).toMatchObject({
      status: 'ACTIVE',
      currentStep: 1,
      lastError: '421 try later',
      nextSendAt: '2026-10-01T10:00:00.000Z',
    });

    mailer.nextResult = { ok: false, error: '550 no such user', bounced: true };
    const at = new Date('2026-10-01T10:00:00Z');
    expect(await sendDueSteps({ store, mailer: mailer as any, now: at })).toMatchObject({ bounced: 1 });
    expect(store.enrollments.get(id)).toMatchObject({ status: 'BOUNCED', nextSendAt: null });
  });

  it('keeps going when one enrollment throws', async () => {
    const id = await enroll();
    mailer.transport.send = async () => {
      throw new Error('boom');
    };
    const summary = await sendDueSteps({ store, mailer: mailer as any, now: NOW });
    expect(summary).toMatchObject({ failed: 1, errors: [{ enrollmentId: id, error: 'boom' }] });
    expect(store.enrollments.get(id)?.status).toBe('ACTIVE');
  });
});

describe('markReply', () => {
  it('stops active enrollments, makes the lead HOT and adds an Inbox item once', async () => {
    const { enrolled } = await enrollPeople({
      store,
      input: { personIds: ['p1'], sequenceId: 'seq-1', campaignId: 'c1' },
      now: NOW,
    });
    await sendDueSteps({ store, mailer: mailer as any, now: NOW });

    const input = {
      fromEmail: 'ADA@acme.com ',
      subject: 'Re: Hi Ada',
      snippet: 'Sounds   good,\nlet us talk',
      messageId: 'msg-1',
      receivedAt: '2026-10-02T08:00:00Z',
    };
    const res = await markReply({ store, input, now: NOW });
    expect(res).toMatchObject({ matched: true, personId: 'p1', leadStatusUpdated: true });
    expect(res.stoppedEnrollmentIds).toEqual([enrolled[0].enrollmentId]);
    expect(store.enrollments.get(enrolled[0].enrollmentId)).toMatchObject({
      status: 'REPLIED',
      nextSendAt: null,
      repliedAt: '2026-10-02T08:00:00.000Z',
    });
    expect(store.people.get('p1')?.leadStatus).toBe('HOT');
    expect(store.campaigns.get('c1')).toMatchObject({ replied: 1 });
    expect(store.inbox).toHaveLength(1);
    expect(store.inbox[0]).toMatchObject({
      kind: 'REPLY',
      snippet: 'Sounds good, let us talk',
      sequenceId: 'seq-1',
      mailboxEmail: 'sales@pulse.test',
    });

    expect((await markReply({ store, input, now: NOW })).reason).toBe('Message already recorded');
    expect(store.inbox).toHaveLength(1);
  });

  it('marks bounces without touching the lead status', async () => {
    await enrollPeople({ store, input: { personIds: ['p1'], sequenceId: 'seq-1' }, now: NOW });
    const res = await markReply({ store, input: { personId: 'p1', kind: 'BOUNCE' }, now: NOW });
    expect(res.stoppedEnrollmentIds).toHaveLength(1);
    expect([...store.enrollments.values()][0].status).toBe('BOUNCED');
    expect(store.people.get('p1')?.leadStatus).toBe('NEW');
  });

  it('ignores senders who are unknown or not in a sequence', async () => {
    expect((await markReply({ store, input: { fromEmail: 'x@y.z' } })).reason).toBe('No matching person');
    expect((await markReply({ store, input: { personId: 'p1' } })).reason).toBe(
      'Person is not in any sequence',
    );
    expect(store.people.get('p1')?.leadStatus).toBe('NEW');
  });
});
