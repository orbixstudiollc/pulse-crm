import { describe, expect, it } from 'vitest';

import { DEFAULT_WARMUP_CONFIG, resolveWarmupConfig } from 'src/gtm/mailbox/config';
import { warmupTagSecret } from 'src/gtm/mailbox/credentials';
import {
  processWarmupInboxes,
  resetDailyCounters,
  runWarmup,
  type EngineDeps,
  type MailboxRepository,
} from 'src/gtm/mailbox/engine';
import { seededRandom } from 'src/gtm/mailbox/random';
import {
  MailRejectedError,
  type InboxMessage,
  type MailTransportFactory,
  type OutgoingMail,
} from 'src/gtm/mailbox/transport';
import type { MailboxRecord, WarmupMessageRecord } from 'src/gtm/mailbox/types';
import { WARMUP_TAG_HEADER } from 'src/gtm/mailbox/warmup-tag';

const tagSecret = warmupTagSecret('engine-test-key-0123456789');

const mailbox = (id: string, email: string, over: Partial<MailboxRecord> = {}): MailboxRecord => ({
  id,
  email,
  displayName: id.toUpperCase(),
  provider: 'GOOGLE',
  smtpHost: null,
  smtpPort: null,
  smtpSecure: null,
  imapHost: null,
  imapPort: null,
  username: null,
  credentialCiphertext: 'v1.a.b.c',
  connectionId: null,
  status: 'WARMING',
  warmupEnabled: true,
  warmupStartedAt: '2026-10-10T00:00:00Z',
  warmupDay: 1,
  warmupStage: 'STARTING',
  dailySendLimit: 0,
  sentToday: 0,
  warmupSentToday: 0,
  lastSentAt: null,
  spamPlacementRate: 0,
  bounceRate: 0,
  healthScore: 100,
  lastError: null,
  ...over,
});

// In-memory Twenty + mail world.
const createWorld = (mailboxes: MailboxRecord[], options: { spamFor?: string[]; rejectTo?: string[]; brokenSmtp?: string[] } = {}) => {
  const boxes = new Map(mailboxes.map((m) => [m.id, { ...m }]));
  const messages: WarmupMessageRecord[] = [];
  const delivered = new Map<string, InboxMessage[]>();
  const sentMail: OutgoingMail[] = [];
  let uid = 1;
  let nextId = 1;

  const repo: MailboxRepository = {
    listMailboxes: async () => [...boxes.values()].map((m) => ({ ...m })),
    updateMailbox: async (id, patch) => {
      const current = boxes.get(id);
      if (current) boxes.set(id, { ...current, ...patch });
    },
    createWarmupMessage: async (input) => {
      const record = { id: `wm${nextId++}`, ...input };
      messages.push(record);
      return { id: record.id };
    },
    findWarmupMessageByTag: async (tag) => messages.find((m) => m.tag === tag) ?? null,
    updateWarmupMessage: async (id, patch) => {
      const index = messages.findIndex((m) => m.id === id);
      messages[index] = { ...messages[index], ...patch };
    },
    listWarmupMessagesSince: async (since) => messages.filter((m) => m.sentAt && new Date(m.sentAt) >= since),
  };

  const transports: MailTransportFactory = {
    async sender(from) {
      if (options.brokenSmtp?.includes(from.email)) throw new Error('535 Authentication failed');
      return {
        async send(mail) {
          if (options.rejectTo?.includes(mail.to.email)) throw new MailRejectedError('550 No such user');
          sentMail.push(mail);
          const messageId = `<${uid}@test>`;
          const inbox = delivered.get(mail.to.email) ?? [];
          inbox.push({
            uid: uid++,
            folder: options.spamFor?.includes(mail.to.email) ? 'SPAM' : 'INBOX',
            messageId,
            subject: mail.subject,
            fromEmail: mail.from.email,
            headers: Object.fromEntries(Object.entries(mail.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
            text: mail.text,
          });
          delivered.set(mail.to.email, inbox);
          return { messageId };
        },
        async close() {},
      };
    },
    async inbox(owner) {
      return {
        async findTagged(prefix) {
          return (delivered.get(owner.email) ?? []).filter((m) => m.text.includes(prefix));
        },
        async markReadAndImportant(message) {
          const list = delivered.get(owner.email) ?? [];
          delivered.set(owner.email, list.filter((m) => m.uid !== message.uid));
        },
        async rescue() {},
        async close() {},
      };
    },
  };

  const deps = (now: Date, configOverride: object = {}): EngineDeps => ({
    repo,
    transports,
    resolveAuth: async (m) => ({ type: 'password', user: m.email, password: 'x' }),
    tagSecret,
    config: resolveWarmupConfig(configOverride),
    now,
    rng: seededRandom(11),
  });

  return { boxes, messages, sentMail, delivered, repo, deps };
};

const pool = () => [
  mailbox('a', 'ann@alpha.com'),
  mailbox('b', 'bob@beta.com', { provider: 'MICROSOFT' }),
  mailbox('c', 'cat@gamma.com'),
  mailbox('d', 'dan@delta.com', { provider: 'MICROSOFT' }),
];

describe('warmup engine', () => {
  it('sends the day 1 volume in the last run of the window and logs it', async () => {
    const world = createWorld(pool());
    const summary = await runWarmup(world.deps(new Date('2026-10-10T18:50:00Z')));
    expect(summary).toMatchObject({ pool: 4, planned: 8, sent: 8, bounced: 0, failedMailboxes: [] });
    expect(world.messages).toHaveLength(8);
    expect(world.sentMail.every((m) => m.headers?.[WARMUP_TAG_HEADER] && m.text.includes(m.headers[WARMUP_TAG_HEADER]))).toBe(true);
    expect(world.sentMail.every((m) => m.from.email !== m.to.email)).toBe(true);
    expect([...world.boxes.values()].map((m) => m.warmupSentToday)).toEqual([2, 2, 2, 2]);

    // A second run the same day has nothing left to send.
    const again = await runWarmup(world.deps(new Date('2026-10-10T18:55:00Z')));
    expect(again.sent).toBe(0);
  });

  it('sends nothing outside the window or with a pool of one', async () => {
    expect((await runWarmup(createWorld(pool()).deps(new Date('2026-10-10T03:00:00Z')))).sent).toBe(0);
    expect((await runWarmup(createWorld(pool().slice(0, 1)).deps(new Date('2026-10-10T18:50:00Z')))).sent).toBe(0);
  });

  it('skips paused, disabled and credential-less mailboxes', async () => {
    const world = createWorld([
      mailbox('a', 'ann@alpha.com'),
      mailbox('b', 'bob@beta.com', { status: 'PAUSED' }),
      mailbox('c', 'cat@gamma.com', { warmupEnabled: false }),
      mailbox('d', 'dan@delta.com', { credentialCiphertext: null }),
    ]);
    expect((await runWarmup(world.deps(new Date('2026-10-10T18:50:00Z')))).pool).toBe(1);
  });

  it('logs bounces and marks broken senders as ERROR', async () => {
    const world = createWorld(pool(), { rejectTo: ['dan@delta.com'], brokenSmtp: ['cat@gamma.com'] });
    const summary = await runWarmup(world.deps(new Date('2026-10-10T18:50:00Z')));
    expect(summary.failedMailboxes).toEqual(['cat@gamma.com']);
    expect(world.boxes.get('c')).toMatchObject({ status: 'ERROR' });
    expect(world.boxes.get('c')?.lastError).toMatch(/Authentication failed/);
    expect(summary.bounced).toBeGreaterThan(0);
    expect(world.messages.filter((m) => m.bounced).every((m) => m.toMailboxId === 'd')).toBe(true);
  });

  it('rescues spam, replies, and updates health from the log', async () => {
    const world = createWorld(pool(), { spamFor: ['bob@beta.com'] });
    await runWarmup(world.deps(new Date('2026-10-10T18:50:00Z')));
    const toBob = world.messages.filter((m) => m.toMailboxId === 'b').length;
    expect(toBob).toBeGreaterThan(0);

    const summary = await processWarmupInboxes(world.deps(new Date('2026-10-10T19:10:00Z'), { replyRate: 1 }));
    // Replies delivered to mailboxes later in the same pass are picked up right away.
    expect(summary.found).toBeGreaterThanOrEqual(8);
    expect(summary.replied).toBe(8);

    const originals = world.messages.filter((m) => m.sentAt === '2026-10-10T18:50:00.000Z');
    expect(originals.every((m) => m.processedAt && m.replied)).toBe(true);
    expect(originals.filter((m) => m.landedInSpam).length).toBe(toBob);
    expect(originals.filter((m) => m.rescued).length).toBe(toBob);

    // Replies are logged too, and are not replied to again.
    const replies = world.messages.filter((m) => m.sentAt === '2026-10-10T19:10:00.000Z');
    expect(replies).toHaveLength(8);
    const second = await processWarmupInboxes(world.deps(new Date('2026-10-10T19:40:00Z'), { replyRate: 1 }));
    expect(summary.found + second.found).toBe(16);
    expect(second.replied).toBe(0);
    expect(summary.rescued + second.rescued).toBe(world.messages.filter((m) => m.toMailboxId === 'b').length);
    expect(world.messages.every((m) => m.processedAt)).toBe(true);

    // Senders to bob got spam placement > 0; health reflects it.
    const sendersToBob = new Set(originals.filter((m) => m.toMailboxId === 'b').map((m) => m.fromMailboxId));
    for (const id of sendersToBob) {
      const box = world.boxes.get(id!)!;
      expect(box.spamPlacementRate).toBeGreaterThan(0);
      expect(box.healthScore).toBeLessThan(100);
    }
  });

  it('auto-pauses a mailbox that keeps landing in spam', async () => {
    const world = createWorld(pool(), { spamFor: ['ann@alpha.com', 'bob@beta.com', 'cat@gamma.com', 'dan@delta.com'] });
    const config = { minSampleForAutoPause: 2 };
    await runWarmup(world.deps(new Date('2026-10-10T18:50:00Z'), config));
    const summary = await processWarmupInboxes(world.deps(new Date('2026-10-10T19:10:00Z'), { ...config, replyRate: 0 }));
    expect(summary.paused.sort()).toEqual(['ann@alpha.com', 'bob@beta.com', 'cat@gamma.com', 'dan@delta.com']);
    expect(world.boxes.get('a')).toMatchObject({ status: 'PAUSED', dailySendLimit: 0 });
    expect(world.boxes.get('a')?.lastError).toMatch(/Auto-paused/);
  });

  it('resets counters daily and promotes mature mailboxes', async () => {
    const world = createWorld([
      mailbox('a', 'ann@alpha.com', { warmupStartedAt: '2026-10-01T09:00:00Z', sentToday: 5, warmupSentToday: 9 }),
      mailbox('b', 'bob@beta.com', { warmupStartedAt: '2026-09-01T09:00:00Z', healthScore: 95 }),
      mailbox('c', 'cat@gamma.com', { warmupStartedAt: null }),
      mailbox('d', 'dan@delta.com', { warmupStartedAt: null, warmupEnabled: false, status: 'ACTIVE', warmupStage: 'MATURE' }),
    ]);
    const now = new Date('2026-10-10T00:05:00Z');
    const result = await resetDailyCounters(world.deps(now));
    expect(result.promoted).toEqual(['bob@beta.com']);
    expect(world.boxes.get('a')).toMatchObject({ sentToday: 0, warmupSentToday: 0, warmupDay: 10, warmupStage: 'BUILDING', dailySendLimit: 10 });
    expect(world.boxes.get('b')).toMatchObject({ status: 'ACTIVE', warmupStage: 'MATURE', dailySendLimit: DEFAULT_WARMUP_CONFIG.stageSendLimits.MATURE });
    expect(world.boxes.get('c')).toMatchObject({ warmupStartedAt: now.toISOString(), warmupDay: 1, warmupStage: 'STARTING', dailySendLimit: 0 });
    expect(world.boxes.get('d')).toMatchObject({ warmupStage: 'MATURE', dailySendLimit: 20, status: 'ACTIVE' });
  });
});
