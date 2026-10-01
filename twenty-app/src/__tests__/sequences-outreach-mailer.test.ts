import { beforeEach, describe, expect, it } from 'vitest';

import { FakeStore } from 'src/__tests__/sequences-fakes';
import { MailRejectedError, type MailSender, type OutgoingMail } from 'src/gtm/mailbox/transport';
import type { MailboxPatch, MailboxRecord } from 'src/gtm/mailbox/types';
import { openTrackingUrlFrom } from 'src/gtm/sequences/app-variables';
import { enrollPeople } from 'src/gtm/sequences/enroll';
import { buildOutreachMailer, pickMailboxForEnrollment } from 'src/gtm/sequences/outreach-mailer';
import { sendDueSteps } from 'src/gtm/sequences/send-due-steps';

const NOW = new Date('2026-10-01T09:00:00Z');

const mailbox = (id: string, over: Partial<MailboxRecord> = {}): MailboxRecord => ({
  id,
  email: `${id}@send.test`,
  displayName: `Sender ${id}`,
  provider: 'GOOGLE',
  smtpHost: null,
  smtpPort: null,
  smtpSecure: null,
  imapHost: null,
  imapPort: null,
  username: null,
  authType: 'PASSWORD',
  credentialCiphertext: 'sealed',
  connectionId: null,
  status: 'ACTIVE',
  warmupEnabled: true,
  warmupStartedAt: null,
  warmupDay: 30,
  warmupStage: 'MATURE',
  dailySendLimit: 2,
  sentToday: 0,
  warmupSentToday: 0,
  lastSentAt: null,
  spamPlacementRate: 0,
  bounceRate: 0,
  healthScore: 90,
  lastError: null,
  ...over,
});

let boxes: MailboxRecord[];
let updates: { id: string; patch: MailboxPatch }[];
let sent: OutgoingMail[];
let closed: number;
let authFails: Set<string>;
let sendError: Error | null;

const deps = () => ({
  listMailboxes: async () => boxes,
  updateMailbox: async (id: string, patch: MailboxPatch) => void updates.push({ id, patch }),
  resolveAuth: async (m: MailboxRecord) => {
    if (authFails.has(m.id)) throw new Error('bad password');
    return { type: 'password' as const, user: m.email, password: 'x' };
  },
  openSender: async (): Promise<MailSender> => ({
    send: async (mail) => {
      if (sendError) throw sendError;
      sent.push(mail);
      return { messageId: `<m${sent.length}@send.test>` };
    },
    close: async () => void (closed += 1),
  }),
  openTrackingUrl: 'https://crm.test/s/sequences/open',
});

beforeEach(() => {
  // a: 1 of 2 used today; b: 0 of 3 used, so b has the larger unused share.
  boxes = [
    mailbox('a', { sentToday: 1, lastSentAt: '2026-10-01T07:00:00Z' }),
    mailbox('b', { dailySendLimit: 3 }),
  ];
  updates = [];
  sent = [];
  closed = 0;
  authFails = new Set();
  sendError = null;
});

describe('pickMailboxForEnrollment', () => {
  it('keeps the enrollment on its own mailbox, waits when it is full, moves when it is broken', () => {
    const full = mailbox('a', { sentToday: 2, lastSentAt: '2026-10-01T08:00:00Z' });
    const other = mailbox('b');
    expect(pickMailboxForEnrollment([mailbox('a'), other], 'A@send.test', NOW)?.id).toBe('a');
    expect(pickMailboxForEnrollment([full, other], 'a@send.test', NOW)).toBeNull();
    expect(pickMailboxForEnrollment([{ ...full, status: 'PAUSED' }, other], 'a@send.test', NOW)?.id).toBe('b');
    expect(pickMailboxForEnrollment([other], 'gone@send.test', NOW)?.id).toBe('b');
    expect(pickMailboxForEnrollment([full], null, NOW)).toBeNull();
  });

  it('respects warmup caps: a STARTING mailbox with no sequence quota is never picked', () => {
    expect(pickMailboxForEnrollment([mailbox('a', { dailySendLimit: 0, status: 'WARMING' })], null, NOW)).toBeNull();
  });
});

describe('buildOutreachMailer', () => {
  it('returns null without mailboxes', async () => {
    boxes = [];
    expect(await buildOutreachMailer(deps())).toBeNull();
  });

  it('sends over the mailbox, counts toward its daily cap and spreads volume', async () => {
    const mailer = (await buildOutreachMailer(deps()))!;
    const pick = () => mailer.mailboxes.pickMailbox({ now: NOW, enrollmentId: 'e', sequenceId: 's' });

    const first = (await pick())!;
    expect(first).toBe('b@send.test'); // most unused share of its cap
    const res = await mailer.transport.send({
      from: first,
      to: 'ada@acme.com',
      subject: 'Hi',
      text: 'Hello',
      html: '<p>Hello</p>',
      enrollmentId: 'e',
      sequenceId: 's',
      stepNumber: 1,
    });
    expect(res).toEqual({ ok: true, messageId: '<m1@send.test>' });
    expect(sent[0]).toMatchObject({
      from: { email: 'b@send.test', name: 'Sender b' },
      to: { email: 'ada@acme.com' },
      html: '<p>Hello</p>',
    });

    await mailer.usage!.recordSend(first, NOW);
    expect(updates).toEqual([{ id: 'b', patch: { sentToday: 1, lastSentAt: NOW.toISOString() } }]);
    expect(mailer.senderNameFor!('b@send.test')).toBe('Sender b');
    expect(mailer.openTrackingUrl).toBe('https://crm.test/s/sequences/open');

    // 3 sends left in total (a: 1, b: 2); after them nothing is picked.
    for (let i = 0; i < 3; i += 1) {
      const next = await pick();
      expect(next).not.toBeNull();
      await mailer.usage!.recordSend(next!, NOW);
    }
    expect(await pick()).toBeNull();
    await mailer.close!();
    expect(closed).toBe(1);
  });

  it('resets a stale counter from an earlier day', async () => {
    boxes = [mailbox('a', { sentToday: 2, lastSentAt: '2026-09-30T18:00:00Z' })];
    const mailer = (await buildOutreachMailer(deps()))!;
    expect(await mailer.mailboxes.pickMailbox({ now: NOW, enrollmentId: 'e', sequenceId: 's' })).toBe('a@send.test');
    await mailer.usage!.recordSend('a@send.test', NOW);
    expect(updates[0].patch.sentToday).toBe(1);
  });

  it('maps rejections to bounces and other errors to retries', async () => {
    const mailer = (await buildOutreachMailer(deps()))!;
    const base = { to: 'x@y.z', subject: 's', text: 't', enrollmentId: 'e', sequenceId: 's', stepNumber: 1 };
    sendError = new MailRejectedError('550 no such user');
    expect(await mailer.transport.send({ ...base, from: 'a@send.test' })).toEqual({
      ok: false,
      error: '550 no such user',
      bounced: true,
    });
    sendError = new Error('ETIMEDOUT');
    expect(await mailer.transport.send({ ...base, from: 'a@send.test' })).toMatchObject({ ok: false, retryable: true });
    expect(await mailer.transport.send({ ...base, from: 'nope@send.test' })).toMatchObject({ retryable: true });
  });

  it('marks a mailbox ERROR when sign-in fails and stops picking it', async () => {
    authFails.add('b');
    const mailer = (await buildOutreachMailer(deps()))!;
    const res = await mailer.transport.send({
      from: 'b@send.test',
      to: 'x@y.z',
      subject: 's',
      text: 't',
      enrollmentId: 'e',
      sequenceId: 's',
      stepNumber: 1,
    });
    expect(res).toMatchObject({ ok: false, retryable: true });
    expect(updates).toEqual([{ id: 'b', patch: { status: 'ERROR', lastError: 'Sign-in failed: bad password' } }]);
    expect(await mailer.mailboxes.pickMailbox({ now: NOW, enrollmentId: 'e', sequenceId: 's', preferred: 'b@send.test' })).toBe(
      'a@send.test',
    );
  });
});

describe('end to end with sendDueSteps', () => {
  it('sends sequence emails through the mailboxes with the pixel and the mailbox sender name', async () => {
    const store = new FakeStore();
    store.people.set('p1', { id: 'p1', name: { firstName: 'Ada' }, emails: { primaryEmail: 'ada@acme.com' } });
    store.sequences.set('seq', {
      id: 'seq',
      name: 'S',
      status: 'ACTIVE',
      businessDaysOnly: false,
      steps: [
        {
          id: 's1',
          order: 1,
          delayDays: 0,
          type: 'EMAIL',
          template: { id: 't', subject: 'Hi {{firstName}}', body: 'Cheers, {{senderName}}' },
        },
      ],
    });
    const { enrolled } = await enrollPeople({ store, input: { personIds: ['p1'], sequenceId: 'seq' }, now: NOW });
    const mailer = (await buildOutreachMailer(deps()))!;
    const summary = await sendDueSteps({ store, mailer, now: NOW });
    expect(summary).toMatchObject({ sent: 1, failed: 0 });
    expect(sent[0]).toMatchObject({ subject: 'Hi Ada', text: 'Cheers, Sender b' });
    expect(sent[0].html).toContain(`https://crm.test/s/sequences/open?e=${enrolled[0].enrollmentId}`);
    expect(store.enrollments.get(enrolled[0].enrollmentId)?.mailboxEmail).toBe('b@send.test');
    expect(updates).toEqual([{ id: 'b', patch: { sentToday: 1, lastSentAt: NOW.toISOString() } }]);
  });
});

describe('openTrackingUrlFrom', () => {
  it('builds the route URL only from an http(s) base', () => {
    expect(openTrackingUrlFrom('https://crm.acme.com/')).toBe('https://crm.acme.com/s/sequences/open');
    expect(openTrackingUrlFrom('')).toBeNull();
    expect(openTrackingUrlFrom('crm.acme.com')).toBeNull();
    expect(openTrackingUrlFrom(undefined)).toBeNull();
  });
});
