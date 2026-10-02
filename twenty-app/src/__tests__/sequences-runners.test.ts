import { beforeEach, describe, expect, it } from 'vitest';

import { FakeMailer, FakeStore } from 'src/__tests__/sequences-fakes';
import { enrollPeople } from 'src/gtm/sequences/enroll';
import { markReply } from 'src/gtm/sequences/mark-reply';
import { sendDueSteps } from 'src/gtm/sequences/send-due-steps';

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
