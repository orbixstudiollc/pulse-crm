import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveWarmupConfig } from 'src/gtm/mailbox/config';
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
  configuredDailySendLimit: over.dailySendLimit ?? 2,
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
  now: () => NOW,
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
    expect(pickMailboxForEnrollment([mailbox('a', { dailySendLimit: 999, configuredDailySendLimit: 10, warmupStage: 'STARTING', status: 'WARMING' })], null, NOW)).toBeNull();
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

  it.each([
    { warmupStage: 'STARTING' as const },
    { configuredDailySendLimit: 0 },
    { configuredDailySendLimit: undefined },
    { configuredDailySendLimit: -1 },
    { status: 'PAUSED' as const },
    { status: 'ERROR' as const },
    { configuredDailySendLimit: 10, warmupStage: 'BUILDING' as const, healthScore: 49, sentToday: 5, lastSentAt: NOW.toISOString() },
    { configuredDailySendLimit: 10, sentToday: 10, lastSentAt: NOW.toISOString() },
    { sentToday: NaN },
  ])('blocks stale-cap direct transport sends before auth/SMTP: %j', async (over) => {
    boxes = [mailbox('a', { ...over, dailySendLimit: 999 })];
    const auth = vi.fn(deps().resolveAuth);
    const open = vi.fn(deps().openSender);
    const mailer = (await buildOutreachMailer({ ...deps(), resolveAuth: auth, openSender: open }))!;
    const res = await mailer.transport.send({ from: 'a@send.test', to: 'x@y.z', subject: 's', text: 't', enrollmentId: 'e', sequenceId: 's', stepNumber: 1 });
    expect(res).toMatchObject({ ok: false, retryable: true });
    expect(auth).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('rechecks a persisted owner change after selection', async () => {
    const mailer = (await buildOutreachMailer({ ...deps(), listMailboxes: async () => boxes.map((m) => ({ ...m })) }))!;
    const from = (await mailer.mailboxes.pickMailbox({ now: NOW, enrollmentId: 'e', sequenceId: 's' }))!;
    boxes = boxes.map((m) => m.email === from ? { ...m, configuredDailySendLimit: 0 } : m);
    expect(await mailer.transport.send({ from, to: 'x@y.z', subject: 's', text: 't', enrollmentId: 'e', sequenceId: 's', stepNumber: 1 })).toMatchObject({ ok: false, retryable: true });
    expect(sent).toEqual([]);
  });

  it('retains successful sends when a fresh server read has stale usage', async () => {
    boxes = [mailbox('a', { configuredDailySendLimit: 1 })];
    const mailer = (await buildOutreachMailer({ ...deps(), listMailboxes: async () => boxes.map((m) => ({ ...m })) }))!;
    const email = { from: 'a@send.test', to: 'x@y.z', subject: 's', text: 't', enrollmentId: 'e', sequenceId: 's', stepNumber: 1 };
    expect(await mailer.transport.send(email)).toMatchObject({ ok: true });
    await mailer.usage!.recordSend(email.from, NOW);
    // The fake deliberately leaves server counters at zero.
    expect(await mailer.transport.send(email)).toMatchObject({ ok: false, retryable: true });
    expect(sent).toHaveLength(1);
    expect(updates[0].patch.sentToday).toBe(1);
  });

  it('holds the mailbox for this run after usage persistence fails', async () => {
    boxes = [mailbox('a')];
    const mailer = (await buildOutreachMailer({ ...deps(), updateMailbox: async () => { throw new Error('write failed'); } }))!;
    const email = { from: 'a@send.test', to: 'x@y.z', subject: 's', text: 't', enrollmentId: 'e', sequenceId: 's', stepNumber: 1 };
    expect(await mailer.transport.send(email)).toMatchObject({ ok: true });
    await expect(mailer.usage!.recordSend(email.from, NOW)).rejects.toThrow('write failed');
    expect(await mailer.mailboxes.pickMailbox({ now: NOW, enrollmentId: 'e', sequenceId: 's', preferred: email.from })).toBeNull();
    expect(await mailer.transport.send(email)).toMatchObject({ ok: false, retryable: true });
    expect(sent).toHaveLength(1);
  });

  it('holds if fresh mailbox policy cannot be loaded', async () => {
    let reads = 0;
    const auth = vi.fn(deps().resolveAuth);
    const mailer = (await buildOutreachMailer({ ...deps(), resolveAuth: auth, listMailboxes: async () => {
      if (reads++ > 0) throw new Error('offline');
      return boxes;
    } }))!;
    expect(await mailer.transport.send({ from: 'a@send.test', to: 'x@y.z', subject: 's', text: 't', enrollmentId: 'e', sequenceId: 's', stepNumber: 1 })).toMatchObject({ ok: false, retryable: true });
    expect(auth).not.toHaveBeenCalled();
  });

  it('uses custom warmup settings for preferred selection, pool and transport', async () => {
    boxes = [mailbox('a', { configuredDailySendLimit: 10, warmupStage: 'BUILDING', sentToday: 3, lastSentAt: NOW.toISOString() })];
    const config = resolveWarmupConfig({ stageSendLimits: { BUILDING: 3 } });
    const mailer = (await buildOutreachMailer({ ...deps(), config }))!;
    expect(pickMailboxForEnrollment(boxes, 'a@send.test', NOW, config)).toBeNull();
    expect(await mailer.mailboxes.pickMailbox({ now: NOW, enrollmentId: 'e', sequenceId: 's' })).toBeNull();
    expect(await mailer.transport.send({ from: 'a@send.test', to: 'x@y.z', subject: 's', text: 't', enrollmentId: 'e', sequenceId: 's', stepNumber: 1 })).toMatchObject({ ok: false, retryable: true });
  });

  it('charges the actual UTC send day if the runner started before midnight', async () => {
    const before = new Date('2026-10-01T23:59:59Z');
    const after = new Date('2026-10-02T00:00:01Z');
    boxes = [mailbox('a', { sentToday: 1, lastSentAt: before.toISOString() })];
    let clock = before;
    const mailer = (await buildOutreachMailer({ ...deps(), now: () => clock }))!;
    expect(await mailer.mailboxes.pickMailbox({ now: before, enrollmentId: 'e', sequenceId: 's' })).toBe('a@send.test');
    clock = after;
    expect(await mailer.transport.send({ from: 'a@send.test', to: 'x@y.z', subject: 's', text: 't', enrollmentId: 'e', sequenceId: 's', stepNumber: 1 })).toMatchObject({ ok: true });
    await mailer.usage!.recordSend('a@send.test', before);
    expect(updates[0].patch).toEqual({ sentToday: 1, lastSentAt: after.toISOString() });
  });

  it('charges the new UTC day when SMTP itself finishes after midnight', async () => {
    const before = new Date('2026-10-01T23:59:59Z');
    const after = new Date('2026-10-02T00:00:01Z');
    boxes = [mailbox('a', { sentToday: 1, lastSentAt: before.toISOString() })];
    let clock = before;
    const mailer = (await buildOutreachMailer({ ...deps(), now: () => clock, openSender: async () => ({
      send: async () => { clock = after; return { messageId: '<midnight>' }; },
      close: async () => {},
    }) }))!;
    expect(await mailer.transport.send({ from: 'a@send.test', to: 'x@y.z', subject: 's', text: 't', enrollmentId: 'e', sequenceId: 's', stepNumber: 1 })).toMatchObject({ ok: true });
    await mailer.usage!.recordSend('a@send.test', before);
    expect(updates[0].patch).toEqual({ sentToday: 1, lastSentAt: after.toISOString() });
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
