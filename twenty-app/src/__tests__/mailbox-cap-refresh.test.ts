import { describe, expect, it } from 'vitest';

import { DEFAULT_WARMUP_CONFIG, resolveWarmupConfig } from 'src/gtm/mailbox/config';
import {
  refreshMailboxStats,
  resetDailyCounters,
  type EngineDeps,
  type MailboxRepository,
} from 'src/gtm/mailbox/engine';
import { pickSendingMailbox, remainingSendsToday, sentTodayFor } from 'src/gtm/mailbox/pick-sending-mailbox';
import type { MailboxPatch, MailboxRecord, WarmupMessageRecord } from 'src/gtm/mailbox/types';
import type { MailboxStatus, WarmupStage } from 'src/gtm/mailbox/values';

const mailbox = (overrides: Partial<MailboxRecord> = {}): MailboxRecord => ({
  id: 'mailbox-a',
  email: 'owner@example.test',
  displayName: 'Owner',
  provider: 'GOOGLE',
  smtpHost: null,
  smtpPort: null,
  smtpSecure: null,
  imapHost: null,
  imapPort: null,
  username: null,
  credentialCiphertext: null,
  connectionId: null,
  status: 'WARMING',
  warmupEnabled: true,
  warmupStartedAt: '2026-10-01T00:00:00Z',
  warmupDay: 1,
  warmupStage: 'STARTING',
  configuredDailySendLimit: 10,
  dailySendLimit: 999,
  dailySendLimitReason: 'Stale cached allowance',
  sentToday: 0,
  warmupSentToday: 0,
  lastSentAt: null,
  spamPlacementRate: 0,
  bounceRate: 0,
  healthScore: 100,
  lastError: null,
  ...overrides,
});

// Only in-memory repository operations are available to these refresh/reset tests.
// No credential resolution, transports, network calls or real sends are used.
const createWorld = (initial: MailboxRecord[], initialLog: WarmupMessageRecord[] = []) => {
  const boxes = new Map(initial.map((box) => [box.id, { ...box }]));
  const log = initialLog.map((message) => ({ ...message }));
  const patches: { id: string; patch: MailboxPatch }[] = [];
  const repo: MailboxRepository = {
    listMailboxes: async () => [...boxes.values()].map((box) => ({ ...box })),
    updateMailbox: async (id, patch) => {
      const current = boxes.get(id);
      if (!current) throw new Error(`Unknown test mailbox: ${id}`);
      patches.push({ id, patch: { ...patch } });
      boxes.set(id, { ...current, ...patch });
    },
    createWarmupMessage: async () => { throw new Error('Refresh/reset must not create warmup messages'); },
    findWarmupMessageByTag: async () => null,
    updateWarmupMessage: async () => { throw new Error('Refresh/reset must not update warmup messages'); },
    listWarmupMessagesSince: async (since) => log.filter((message) => message.sentAt && new Date(message.sentAt) >= since),
  };
  const deps = (at: string, config = DEFAULT_WARMUP_CONFIG): Pick<EngineDeps, 'repo' | 'config' | 'now'> => ({
    repo,
    config,
    now: new Date(at),
  });
  return { boxes, patches, repo, deps };
};

const spamMessage = (id: string): WarmupMessageRecord => ({
  id,
  subject: 'Test warmup',
  fromMailboxId: 'mailbox-a',
  toMailboxId: 'mailbox-b',
  sentAt: '2026-10-22T09:00:00Z',
  messageId: null,
  tag: null,
  landedInSpam: true,
  rescued: false,
  replied: false,
  bounced: false,
  processedAt: '2026-10-22T09:05:00Z',
});

const expectDerivedOnly = (patches: { patch: MailboxPatch }[]) => {
  expect(patches.length).toBeGreaterThan(0);
  for (const { patch } of patches) {
    expect(patch).not.toHaveProperty('configuredDailySendLimit');
    expect(patch).toHaveProperty('dailySendLimit');
    expect(patch.dailySendLimitReason).toEqual(expect.any(String));
    expect(patch.dailySendLimitReason?.length).toBeGreaterThan(0);
  }
};

describe('owner maximum through refresh and rollover', () => {
  it('preserves 10 across repeated refreshes and rollovers through every warmup stage', async () => {
    const world = createWorld([mailbox()]);
    const stages: [string, WarmupStage, number][] = [
      ['2026-10-01T00:05:00Z', 'STARTING', 0],
      ['2026-10-08T00:05:00Z', 'BUILDING', 10],
      ['2026-10-15T00:05:00Z', 'RAMPING', 10],
      ['2026-10-22T00:05:00Z', 'MATURE', 10],
    ];
    for (const [at, stage, effective] of stages) {
      const deps = world.deps(at);
      for (let repeat = 0; repeat < 2; repeat++) {
        await refreshMailboxStats(deps, await world.repo.listMailboxes());
        expect(world.boxes.get('mailbox-a')).toMatchObject({ configuredDailySendLimit: 10, dailySendLimit: effective });
        expect(world.boxes.get('mailbox-a')?.dailySendLimitReason).toContain(stage);
        await resetDailyCounters(deps);
        expect(world.boxes.get('mailbox-a')).toMatchObject({
          configuredDailySendLimit: 10,
          dailySendLimit: effective,
          warmupStage: stage,
        });
      }
    }
    expect(world.boxes.get('mailbox-a')?.status).toBe('ACTIVE');
    expectDerivedOnly(world.patches);
  });

  it.each([undefined, null, 0, -1, 1.5])('does not invent or overwrite owner maximum %s during automation', async (configuredDailySendLimit) => {
    const world = createWorld([mailbox({ configuredDailySendLimit })]);
    const deps = world.deps('2026-10-22T12:00:00Z');
    await refreshMailboxStats(deps, await world.repo.listMailboxes());
    await resetDailyCounters(deps);
    await refreshMailboxStats(deps, await world.repo.listMailboxes());
    expect(world.boxes.get('mailbox-a')?.configuredDailySendLimit).toBe(configuredDailySendLimit);
    expect(world.boxes.get('mailbox-a')?.dailySendLimit).toBe(0);
    expectDerivedOnly(world.patches);
  });

  it.each(['PAUSED', 'ERROR', 'UNKNOWN', null])('keeps status %s on hold across refresh and reset', async (status) => {
    const world = createWorld([mailbox({ status: status as MailboxStatus | null })]);
    const deps = world.deps('2026-10-22T12:00:00Z');
    await refreshMailboxStats(deps, await world.repo.listMailboxes());
    await resetDailyCounters(deps);
    expect(world.boxes.get('mailbox-a')).toMatchObject({ status, configuredDailySendLimit: 10, dailySendLimit: 0 });
    expectDerivedOnly(world.patches);
  });

  it('reduces the stage allowance for low health without halving the owner maximum', async () => {
    const world = createWorld([mailbox({
      warmupStartedAt: '2026-10-08T00:00:00Z',
      warmupStage: 'MATURE',
    })], [spamMessage('sample-1')]);
    const deps = world.deps('2026-10-22T12:00:00Z');
    await refreshMailboxStats(deps, await world.repo.listMailboxes());
    expect(world.boxes.get('mailbox-a')).toMatchObject({ healthScore: 40, configuredDailySendLimit: 10, dailySendLimit: 7 });
    expect(world.boxes.get('mailbox-a')?.dailySendLimitReason).toMatch(/health/i);
    await resetDailyCounters(deps);
    expect(world.boxes.get('mailbox-a')).toMatchObject({ warmupStage: 'RAMPING', configuredDailySendLimit: 10, dailySendLimit: 7 });
    expectDerivedOnly(world.patches);
  });

  it('preserves the owner maximum when health refresh auto-pauses a mailbox', async () => {
    const world = createWorld([mailbox()], [spamMessage('sample-1'), spamMessage('sample-2')]);
    const deps = world.deps('2026-10-22T12:00:00Z', resolveWarmupConfig({ minSampleForAutoPause: 2 }));
    const paused = await refreshMailboxStats(deps, await world.repo.listMailboxes());
    expect(paused).toEqual(['owner@example.test']);
    expect(world.boxes.get('mailbox-a')).toMatchObject({ status: 'PAUSED', configuredDailySendLimit: 10, dailySendLimit: 0 });
    expect(world.boxes.get('mailbox-a')?.dailySendLimitReason).toMatch(/PAUSED/);
    await resetDailyCounters(deps);
    expect(world.boxes.get('mailbox-a')).toMatchObject({ status: 'PAUSED', configuredDailySendLimit: 10, dailySendLimit: 0 });
    expectDerivedOnly(world.patches);
  });
});

describe('UTC rollover cannot replenish today’s exhausted allowance', () => {
  it('preserves all 10 sends made at 00:00 when the reset cron runs at 00:05', async () => {
    const world = createWorld([mailbox({ sentToday: 10, lastSentAt: '2026-10-21T23:59:59Z' })]);
    const midnight = new Date('2026-10-22T00:00:00Z');

    // Simulate successful sequence sends through the picker and in-memory counter.
    // Yesterday's full counter must not prevent the first send after UTC midnight.
    for (let sent = 0; sent < 10; sent++) {
      const selected = pickSendingMailbox(await world.repo.listMailboxes(), midnight);
      expect(selected?.id).toBe('mailbox-a');
      if (!selected) throw new Error('Expected remaining midnight capacity');
      await world.repo.updateMailbox(selected.id, {
        sentToday: sentTodayFor(selected, midnight) + 1,
        lastSentAt: midnight.toISOString(),
      });
    }
    expect(pickSendingMailbox(await world.repo.listMailboxes(), midnight)).toBeNull();
    const resetPatchStart = world.patches.length;
    await resetDailyCounters(world.deps('2026-10-22T00:05:00Z'));
    await resetDailyCounters(world.deps('2026-10-22T00:06:00Z'));
    expect(world.boxes.get('mailbox-a')).toMatchObject({ configuredDailySendLimit: 10, dailySendLimit: 10, sentToday: 10 });
    expect(pickSendingMailbox(await world.repo.listMailboxes(), new Date('2026-10-22T00:06:00Z'))).toBeNull();
    expectDerivedOnly(world.patches.slice(resetPatchStart));
  });

  it('resets yesterday’s sequence usage while preserving the owner maximum', async () => {
    const world = createWorld([mailbox({ sentToday: 10, warmupSentToday: 40, lastSentAt: '2026-10-21T23:59:59Z' })]);
    const deps = world.deps('2026-10-22T00:05:00Z');
    await resetDailyCounters(deps);
    const box = world.boxes.get('mailbox-a')!;
    expect(box).toMatchObject({ configuredDailySendLimit: 10, dailySendLimit: 10, sentToday: 0, warmupSentToday: 0 });
    expect(remainingSendsToday(box, deps.now)).toBe(10);
    expectDerivedOnly(world.patches);
  });

  it('does not assume a full counter is yesterday’s when the timestamp is missing', async () => {
    const world = createWorld([mailbox({ sentToday: 10, lastSentAt: null })]);
    const deps = world.deps('2026-10-22T00:05:00Z');
    await resetDailyCounters(deps);
    expect(world.boxes.get('mailbox-a')?.sentToday).toBe(10);
    expect(pickSendingMailbox(await world.repo.listMailboxes(), deps.now)).toBeNull();
    expectDerivedOnly(world.patches);
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'])('does not erase malformed same-day usage %s and reopen capacity', async (sentToday) => {
    const world = createWorld([mailbox({ sentToday: sentToday as number, lastSentAt: '2026-10-22T00:00:00Z' })]);
    const deps = world.deps('2026-10-22T00:05:00Z');
    await resetDailyCounters(deps);
    expect(world.boxes.get('mailbox-a')?.sentToday).toBe(sentToday);
    expect(world.patches[0].patch).not.toHaveProperty('sentToday');
    expect(pickSendingMailbox(await world.repo.listMailboxes(), deps.now)).toBeNull();
    expectDerivedOnly(world.patches);
  });

  it.each(['invalid-date', '2026-10-23T00:00:00Z'])('keeps outreach blocked when the usage timestamp is %s', async (lastSentAt) => {
    const world = createWorld([mailbox({ sentToday: 10, lastSentAt })]);
    const deps = world.deps('2026-10-22T00:05:00Z');
    await resetDailyCounters(deps);
    expect(world.boxes.get('mailbox-a')?.sentToday).toBe(10);
    expect(world.patches[0].patch).not.toHaveProperty('sentToday');
    expect(pickSendingMailbox(await world.repo.listMailboxes(), deps.now)).toBeNull();
    expectDerivedOnly(world.patches);
  });
});
