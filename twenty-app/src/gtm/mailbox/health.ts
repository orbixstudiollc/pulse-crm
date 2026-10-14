import { DEFAULT_WARMUP_CONFIG, type WarmupConfig } from 'src/gtm/mailbox/config';
import type { MailboxStatus } from 'src/gtm/mailbox/values';

export type PlacementSample = {
  sentAt: string | Date | null;
  processedAt?: string | Date | null;
  landedInSpam?: boolean | null;
  replied?: boolean | null;
  bounced?: boolean | null;
};

export type PlacementStats = {
  // Warmup emails sent in the window.
  sent: number;
  // Of those, how many a receiving inbox has seen (so placement is known).
  processed: number;
  spamPlacementRate: number;
  bounceRate: number;
  replyRate: number;
};

const toTime = (value: string | Date | null | undefined): number | null => {
  if (!value) return null;
  const time = (typeof value === 'string' ? new Date(value) : value).getTime();
  return Number.isNaN(time) ? null : time;
};

const round4 = (value: number) => Math.round(value * 10000) / 10000;

// Rates over a mailbox's sent warmup emails in the trailing window.
export const computePlacementStats = (
  samples: readonly PlacementSample[],
  now: Date,
  windowDays = DEFAULT_WARMUP_CONFIG.statsWindowDays,
): PlacementStats => {
  const since = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  let sent = 0;
  let processed = 0;
  let spam = 0;
  let replied = 0;
  let bounced = 0;

  for (const sample of samples) {
    const sentAt = toTime(sample.sentAt);
    if (sentAt === null || sentAt < since || sentAt > now.getTime()) continue;
    sent++;
    if (sample.bounced) bounced++;
    if (toTime(sample.processedAt ?? null) !== null) {
      processed++;
      if (sample.landedInSpam) spam++;
      if (sample.replied) replied++;
    }
  }

  return {
    sent,
    processed,
    spamPlacementRate: processed ? round4(spam / processed) : 0,
    bounceRate: sent ? round4(bounced / sent) : 0,
    replyRate: processed ? round4(replied / processed) : 0,
  };
};

// 0..100. Spam placement and bounces cost the most; an error status caps it.
export const computeHealthScore = (input: {
  spamPlacementRate: number;
  bounceRate: number;
  status: MailboxStatus;
  hasRecentError?: boolean;
}): number => {
  let score = 100;
  score -= Math.min(60, input.spamPlacementRate * 120);
  score -= Math.min(40, input.bounceRate * 400);
  if (input.hasRecentError) score -= 15;
  if (input.status === 'ERROR') score = Math.min(score, 20);
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const healthLabel = (score: number): 'GOOD' | 'FAIR' | 'POOR' =>
  score >= 80 ? 'GOOD' : score >= 60 ? 'FAIR' : 'POOR';

// Pause a mailbox when it is clearly burning: too much spam placement or too
// many bounces, measured on enough mail to be meaningful.
export const autoPauseReason = (
  stats: PlacementStats,
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
): string | null => {
  if (stats.processed >= config.minSampleForAutoPause && stats.spamPlacementRate >= config.autoPauseSpamRate) {
    return `Spam placement ${(stats.spamPlacementRate * 100).toFixed(0)}% over the last ${config.statsWindowDays} days`;
  }
  if (stats.sent >= config.minSampleForAutoPause && stats.bounceRate >= config.autoPauseBounceRate) {
    return `Bounce rate ${(stats.bounceRate * 100).toFixed(0)}% over the last ${config.statsWindowDays} days`;
  }
  return null;
};
