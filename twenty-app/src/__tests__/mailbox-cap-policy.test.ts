import { describe, expect, it } from 'vitest';

import { resolveWarmupConfig } from 'src/gtm/mailbox/config';
import {
  pickSendingMailbox,
  remainingSendsToday,
  sentTodayFor,
  type SendingMailboxLike,
} from 'src/gtm/mailbox/pick-sending-mailbox';
import { effectiveDailySendPolicy, type DailySendPolicyInput } from 'src/gtm/mailbox/ramp';
import type { MailboxStatus, WarmupStage } from 'src/gtm/mailbox/values';

const now = new Date('2026-10-22T12:00:00Z');
const policyInput = (overrides: Partial<DailySendPolicyInput> = {}): DailySendPolicyInput => ({
  configuredDailySendLimit: 10,
  warmupStage: 'MATURE',
  warmupStartedAt: null,
  status: 'ACTIVE',
  healthScore: 100,
  ...overrides,
});

const sendingMailbox = (overrides: Partial<SendingMailboxLike> = {}): SendingMailboxLike => ({
  ...policyInput(),
  id: 'mailbox-a',
  dailySendLimit: 999,
  sentToday: 0,
  lastSentAt: null,
  ...overrides,
});

describe('effectiveDailySendPolicy', () => {
  it.each<[WarmupStage, number]>([
    ['STARTING', 0],
    ['BUILDING', 10],
    ['RAMPING', 10],
    ['MATURE', 10],
  ])('keeps an owner maximum of 10 at %s within its effective allowance', (warmupStage, expected) => {
    const result = effectiveDailySendPolicy(policyInput({ warmupStage }), now);
    expect(result.dailySendLimit).toBe(expected);
    expect(result.dailySendLimitReason).toContain('10');
    expect(result.dailySendLimitReason).toContain(warmupStage);
  });

  it.each([undefined, null, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '10'])(
    'holds outreach for an absent or invalid owner maximum: %s',
    (maximum) => {
      const result = effectiveDailySendPolicy(policyInput({
        configuredDailySendLimit: maximum as number | null | undefined,
      }), now);
      expect(result.dailySendLimit).toBe(0);
      expect(result.dailySendLimitReason).toMatch(/maximum|whole number/i);
    },
  );

  it('treats an explicit owner maximum of zero as an intentional hold', () => {
    const result = effectiveDailySendPolicy(policyInput({ configuredDailySendLimit: 0 }), now);
    expect(result.dailySendLimit).toBe(0);
    expect(result.dailySendLimitReason).toMatch(/maximum.*0/i);
  });

  it.each(['WARMING', 'ACTIVE'] as const)('allows eligible %s mailboxes up to the owner maximum', (status) => {
    expect(effectiveDailySendPolicy(policyInput({ status }), now).dailySendLimit).toBe(10);
  });

  it.each(['PAUSED', 'ERROR', 'UNKNOWN', null])('holds outreach for status %s', (status) => {
    const result = effectiveDailySendPolicy(policyInput({ status: status as MailboxStatus | null }), now);
    expect(result.dailySendLimit).toBe(0);
    expect(result.dailySendLimitReason).toMatch(/hold/i);
  });

  it.each<[WarmupStage, number]>([
    ['STARTING', 0],
    ['BUILDING', 5],
    ['RAMPING', 7],
    ['MATURE', 10],
  ])('halves the %s stage allowance before applying the owner maximum', (warmupStage, expected) => {
    const result = effectiveDailySendPolicy(policyInput({ warmupStage, healthScore: 49 }), now);
    expect(result.dailySendLimit).toBe(expected);
    expect(result.dailySendLimitReason).toMatch(/health/i);
  });

  it('does not halve the owner maximum when it is already lower than the healthy allowance', () => {
    expect(effectiveDailySendPolicy(policyInput({ configuredDailySendLimit: 3, healthScore: 49 }), now).dailySendLimit).toBe(3);
    expect(effectiveDailySendPolicy(policyInput({ warmupStage: 'RAMPING', healthScore: 50 }), now).dailySendLimit).toBe(10);
  });

  it.each([NaN, Infinity, -1, 101])('holds outreach for an invalid health score: %s', (healthScore) => {
    const result = effectiveDailySendPolicy(policyInput({ healthScore }), now);
    expect(result.dailySendLimit).toBe(0);
    expect(result.dailySendLimitReason).toMatch(/health/i);
  });

  it.each<[string, number]>([
    ['2026-10-01T12:00:00Z', 0],
    ['2026-10-07T23:59:59Z', 0],
    ['2026-10-08T00:00:00Z', 10],
    ['2026-10-15T00:00:00Z', 15],
    ['2026-10-22T00:00:00Z', 20],
  ])('derives the stage from the actual warmup start at %s', (at, expected) => {
    const input = policyInput({
      configuredDailySendLimit: 50,
      warmupStartedAt: '2026-10-01T15:00:00Z',
      warmupStage: expected === 0 ? 'MATURE' : 'STARTING',
    });
    expect(effectiveDailySendPolicy(input, new Date(at)).dailySendLimit).toBe(expected);
  });

  it.each(['invalid-date', '2026-10-23T00:00:00Z'])('does not trust a mature cached stage with start date %s', (warmupStartedAt) => {
    expect(effectiveDailySendPolicy(policyInput({ warmupStartedAt }), now).dailySendLimit).toBe(0);
  });

  it('holds outreach when the current clock is invalid', () => {
    const invalidNow = new Date('invalid-date');
    const result = effectiveDailySendPolicy(policyInput(), invalidNow);
    expect(result.dailySendLimit).toBe(0);
    expect(result.dailySendLimitReason).toMatch(/clock/i);
    expect(pickSendingMailbox([sendingMailbox()], invalidNow)).toBeNull();
  });

  it('defaults an unknown or absent warmup stage to no outreach', () => {
    expect(effectiveDailySendPolicy(policyInput({ warmupStage: null }), now).dailySendLimit).toBe(0);
    expect(effectiveDailySendPolicy(policyInput({ warmupStage: 'UNKNOWN' as WarmupStage }), now).dailySendLimit).toBe(0);
  });

  it.each([0, 20, 999, null])('ignores a stale derived dailySendLimit of %s', (dailySendLimit) => {
    const mailbox = sendingMailbox({ dailySendLimit });
    expect(effectiveDailySendPolicy(mailbox, now).dailySendLimit).toBe(10);
    expect(remainingSendsToday(mailbox, now)).toBe(10);
  });

  it('honors configured stage limits without allowing them to raise the owner maximum', () => {
    const config = resolveWarmupConfig({ stageSendLimits: { MATURE: 60, RAMPING: 9 } });
    expect(effectiveDailySendPolicy(policyInput(), now, config).dailySendLimit).toBe(10);
    expect(effectiveDailySendPolicy(policyInput({ warmupStage: 'RAMPING' }), now, config).dailySendLimit).toBe(9);
    expect(effectiveDailySendPolicy(policyInput({ warmupStage: 'RAMPING', healthScore: 49 }), now, config).dailySendLimit).toBe(4);
  });
});

describe('sequence usage under the owner maximum', () => {
  it('stops selection at the effective maximum even when the cached limit is higher', () => {
    const mailbox = sendingMailbox({ sentToday: 9, lastSentAt: '2026-10-22T10:00:00Z' });
    expect(remainingSendsToday(mailbox, now)).toBe(1);
    expect(pickSendingMailbox([mailbox], now)).toBe(mailbox);
    mailbox.sentToday = 10;
    expect(remainingSendsToday(mailbox, now)).toBe(0);
    expect(pickSendingMailbox([mailbox], now)).toBeNull();
    mailbox.sentToday = 11;
    expect(remainingSendsToday(mailbox, now)).toBe(0);
  });

  it('fails closed on a legacy mailbox with only a cached daily limit', () => {
    const mailbox = sendingMailbox({ configuredDailySendLimit: undefined, dailySendLimit: 20 });
    expect(remainingSendsToday(mailbox, now)).toBe(0);
    expect(pickSendingMailbox([mailbox], now)).toBeNull();
  });

  it('counts usage by UTC day before the delayed rollover cron', () => {
    const midnight = new Date('2026-10-22T00:00:00Z');
    const yesterday = sendingMailbox({ sentToday: 10, lastSentAt: '2026-10-21T23:59:59Z' });
    const todayInAnotherOffset = sendingMailbox({ sentToday: 10, lastSentAt: '2026-10-21T20:00:00-04:00' });
    expect(sentTodayFor(yesterday, midnight)).toBe(0);
    expect(remainingSendsToday(yesterday, midnight)).toBe(10);
    expect(sentTodayFor(todayInAnotherOffset, midnight)).toBe(10);
    expect(remainingSendsToday(todayInAnotherOffset, midnight)).toBe(0);
  });

  it('retains recorded usage conservatively when the send timestamp is missing', () => {
    const mailbox = sendingMailbox({ sentToday: 10, lastSentAt: null });
    expect(sentTodayFor(mailbox, now)).toBe(10);
    expect(pickSendingMailbox([mailbox], now)).toBeNull();
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'])('fails closed on malformed same-day usage: %s', (sentToday) => {
    const mailbox = sendingMailbox({ sentToday: sentToday as number, lastSentAt: '2026-10-22T10:00:00Z' });
    expect(sentTodayFor(mailbox, now)).toBe(Infinity);
    expect(remainingSendsToday(mailbox, now)).toBe(0);
    expect(pickSendingMailbox([mailbox], now)).toBeNull();
  });

  it.each(['invalid-date', '2026-10-23T00:00:00Z'])('fails closed on an untrustworthy send timestamp: %s', (lastSentAt) => {
    const mailbox = sendingMailbox({ lastSentAt });
    expect(sentTodayFor(mailbox, now)).toBe(Infinity);
    expect(pickSendingMailbox([mailbox], now)).toBeNull();
  });
});
