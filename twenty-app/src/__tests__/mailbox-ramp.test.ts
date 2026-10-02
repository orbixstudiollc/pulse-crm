import { describe, expect, it } from 'vitest';

import { DEFAULT_WARMUP_CONFIG, resolveWarmupConfig } from 'src/gtm/mailbox/config';
import {
  dailySendLimitFor,
  rampSchedule,
  runsLeftInWindow,
  sendsThisRun,
  stageForDay,
  warmupDayFor,
  warmupVolumeForDay,
} from 'src/gtm/mailbox/ramp';
import { seededRandom } from 'src/gtm/mailbox/random';

describe('warmup ramp', () => {
  it('starts at about 2 a day and reaches about 40 by day 24', () => {
    expect(warmupVolumeForDay(0)).toBe(0);
    expect(warmupVolumeForDay(1)).toBe(2);
    expect(warmupVolumeForDay(12)).toBeGreaterThan(15);
    expect(warmupVolumeForDay(12)).toBeLessThan(25);
    expect(warmupVolumeForDay(24)).toBe(40);
    expect(warmupVolumeForDay(60)).toBe(40);
  });

  it('never goes down from one day to the next', () => {
    const schedule = rampSchedule();
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].volume).toBeGreaterThanOrEqual(schedule[i - 1].volume);
    }
  });

  it('is configurable', () => {
    const config = resolveWarmupConfig({ startVolume: 5, maxVolume: 20, rampDays: 10 });
    expect(warmupVolumeForDay(1, config)).toBe(5);
    expect(warmupVolumeForDay(10, config)).toBe(20);
  });

  it('counts warmup days from the start date in UTC', () => {
    const now = new Date('2026-10-10T08:00:00Z');
    expect(warmupDayFor(null, now)).toBe(0);
    expect(warmupDayFor('2026-10-10T23:00:00Z', now)).toBe(1);
    expect(warmupDayFor('2026-10-01T00:00:00Z', now)).toBe(10);
    expect(warmupDayFor('2026-10-11T00:00:00Z', now)).toBe(0);
  });

  it('maps days to stages and stages to send caps', () => {
    expect(stageForDay(1)).toBe('STARTING');
    expect(stageForDay(8)).toBe('BUILDING');
    expect(stageForDay(15)).toBe('RAMPING');
    expect(stageForDay(22)).toBe('MATURE');
    expect(dailySendLimitFor({ stage: 'STARTING', status: 'WARMING' })).toBe(0);
    expect(dailySendLimitFor({ stage: 'BUILDING', status: 'WARMING' })).toBe(10);
    expect(dailySendLimitFor({ stage: 'MATURE', status: 'ACTIVE' })).toBe(20);
    expect(dailySendLimitFor({ stage: 'MATURE', status: 'PAUSED' })).toBe(0);
    expect(dailySendLimitFor({ stage: 'MATURE', status: 'ERROR' })).toBe(0);
    expect(dailySendLimitFor({ stage: 'MATURE', status: 'ACTIVE', healthScore: 30 })).toBe(10);
  });

  it('spreads the day over the send window', () => {
    expect(runsLeftInWindow(new Date('2026-10-10T05:00:00Z'))).toBe(0);
    expect(runsLeftInWindow(new Date('2026-10-10T19:00:00Z'))).toBe(0);
    expect(runsLeftInWindow(new Date('2026-10-10T18:50:00Z'))).toBe(1);
    expect(runsLeftInWindow(new Date('2026-10-10T07:00:00Z'))).toBe(36);

    const rng = seededRandom(1);
    expect(sendsThisRun(10, new Date('2026-10-10T18:50:00Z'), DEFAULT_WARMUP_CONFIG, rng)).toBe(10);
    expect(sendsThisRun(0, new Date('2026-10-10T12:00:00Z'), DEFAULT_WARMUP_CONFIG, rng)).toBe(0);

    // Simulate a whole day: every run of the window together sends the full volume.
    let remaining = 40;
    for (let minute = 7 * 60; minute < 19 * 60; minute += 20) {
      const now = new Date(Date.UTC(2026, 9, 10, 0, minute));
      remaining -= sendsThisRun(remaining, now, DEFAULT_WARMUP_CONFIG, rng);
    }
    expect(remaining).toBe(0);
  });
});

describe('resolveWarmupConfig', () => {
  it('ignores bad input and keeps defaults', () => {
    expect(resolveWarmupConfig(undefined)).toEqual(DEFAULT_WARMUP_CONFIG);
    expect(resolveWarmupConfig('not json')).toEqual(DEFAULT_WARMUP_CONFIG);
    expect(resolveWarmupConfig({ maxVolume: 'lots', replyRate: -1 })).toEqual(DEFAULT_WARMUP_CONFIG);
  });

  it('accepts JSON strings and partial stage limits', () => {
    const config = resolveWarmupConfig('{"maxVolume":30,"stageSendLimits":{"MATURE":60},"stageStartDays":[5,10,15]}');
    expect(config.maxVolume).toBe(30);
    expect(config.stageSendLimits.MATURE).toBe(60);
    expect(config.stageSendLimits.BUILDING).toBe(10);
    expect(config.stageStartDays).toEqual([5, 10, 15]);
    expect(DEFAULT_WARMUP_CONFIG.stageSendLimits.MATURE).toBe(20);
  });
});
