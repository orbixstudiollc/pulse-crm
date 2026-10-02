import { describe, expect, it } from 'vitest';

import { autoPauseReason, computeHealthScore, computePlacementStats, healthLabel } from 'src/gtm/mailbox/health';
import { pickSendingMailbox, remainingSendsToday, type SendingMailboxLike } from 'src/gtm/mailbox/pick-sending-mailbox';

const now = new Date('2026-10-10T12:00:00Z');

describe('placement stats and health', () => {
  const day = (d: number) => new Date(Date.UTC(2026, 9, d, 9)).toISOString();

  it('computes rates over the trailing window from processed mail', () => {
    const stats = computePlacementStats(
      [
        { sentAt: day(9), processedAt: day(9), landedInSpam: true, replied: false },
        { sentAt: day(9), processedAt: day(9), landedInSpam: false, replied: true },
        { sentAt: day(9), processedAt: day(9), landedInSpam: false, replied: false },
        { sentAt: day(9), processedAt: day(9), landedInSpam: false, replied: false },
        { sentAt: day(10), processedAt: null, bounced: true },
        { sentAt: day(1), processedAt: day(1), landedInSpam: true }, // outside 7-day window
      ],
      now,
      7,
    );
    expect(stats).toEqual({ sent: 5, processed: 4, spamPlacementRate: 0.25, bounceRate: 0.2, replyRate: 0.25 });
  });

  it('scores health from spam, bounces and errors', () => {
    expect(computeHealthScore({ spamPlacementRate: 0, bounceRate: 0, status: 'ACTIVE' })).toBe(100);
    expect(computeHealthScore({ spamPlacementRate: 0.1, bounceRate: 0.02, status: 'ACTIVE' })).toBe(80);
    expect(computeHealthScore({ spamPlacementRate: 1, bounceRate: 1, status: 'ACTIVE' })).toBe(0);
    expect(computeHealthScore({ spamPlacementRate: 0, bounceRate: 0, status: 'ERROR' })).toBe(20);
    expect(healthLabel(85)).toBe('GOOD');
    expect(healthLabel(65)).toBe('FAIR');
    expect(healthLabel(10)).toBe('POOR');
  });

  it('auto-pauses only on enough evidence', () => {
    const base = { sent: 20, processed: 20, spamPlacementRate: 0.5, bounceRate: 0, replyRate: 0 };
    expect(autoPauseReason(base)).toMatch(/Spam placement 50%/);
    expect(autoPauseReason({ ...base, processed: 3 })).toBeNull();
    expect(autoPauseReason({ ...base, spamPlacementRate: 0, bounceRate: 0.1 })).toMatch(/Bounce rate 10%/);
    expect(autoPauseReason({ ...base, spamPlacementRate: 0.1 })).toBeNull();
  });
});

describe('pickSendingMailbox', () => {
  const box = (over: Partial<SendingMailboxLike> & { id: string }): SendingMailboxLike => ({
    status: 'ACTIVE',
    dailySendLimit: 20,
    configuredDailySendLimit: over.dailySendLimit ?? 20,
    warmupStage: 'MATURE',
    sentToday: 0,
    lastSentAt: '2026-10-10T08:00:00Z',
    healthScore: 90,
    ...over,
  });

  it('returns null when nothing can send', () => {
    expect(pickSendingMailbox([], now)).toBeNull();
    expect(
      pickSendingMailbox(
        [
          box({ id: 'full', sentToday: 40 }),
          box({ id: 'paused', status: 'PAUSED' }),
          box({ id: 'error', status: 'ERROR' }),
          box({ id: 'cold', status: 'WARMING', warmupStage: 'STARTING', dailySendLimit: 999 }),
        ],
        now,
      ),
    ).toBeNull();
  });

  it('prefers the most unused share of the cap, then the longest idle', () => {
    const picked = pickSendingMailbox(
      [box({ id: 'busy', sentToday: 30 }), box({ id: 'fresh', sentToday: 5, dailySendLimit: 10 }), box({ id: 'idle', sentToday: 4 })],
      now,
    );
    expect(picked?.id).toBe('idle');
    const tie = pickSendingMailbox(
      [box({ id: 'recent', lastSentAt: '2026-10-10T11:59:00Z' }), box({ id: 'older', lastSentAt: '2026-10-10T07:00:00Z' })],
      now,
    );
    expect(tie?.id).toBe('older');
  });

  it('treats yesterday\'s counter as stale', () => {
    const stale = box({ id: 'stale', sentToday: 40, lastSentAt: '2026-10-09T18:00:00Z' });
    expect(remainingSendsToday(stale, now)).toBe(20);
    expect(pickSendingMailbox([stale], now)?.id).toBe('stale');
  });

  it('drains the pool fairly when the caller increments counters', () => {
    const boxes = [box({ id: 'a', dailySendLimit: 3 }), box({ id: 'b', dailySendLimit: 3 }), box({ id: 'c', dailySendLimit: 2 })];
    const order: string[] = [];
    for (let i = 0; i < 10; i++) {
      const pick = pickSendingMailbox(boxes, now);
      if (!pick) break;
      order.push(pick.id);
      pick.sentToday = (pick.sentToday ?? 0) + 1;
      pick.lastSentAt = new Date(now.getTime() + i * 1000).toISOString();
    }
    expect(order).toHaveLength(8);
    expect(order.slice(0, 3).sort()).toEqual(['a', 'b', 'c']);
  });
});
