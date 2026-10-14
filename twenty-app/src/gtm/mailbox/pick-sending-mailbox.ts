import { DEFAULT_WARMUP_CONFIG, type WarmupConfig } from 'src/gtm/mailbox/config';
import { effectiveDailySendPolicy, isSameUtcDay, type DailySendPolicyInput } from 'src/gtm/mailbox/ramp';
import type { MailboxStatus } from 'src/gtm/mailbox/values';

// The fields pickSendingMailbox needs. MailboxRecord satisfies it.
export type SendingMailboxLike = DailySendPolicyInput & {
  id: string;
  status: MailboxStatus | null;
  dailySendLimit: number | null;
  sentToday: number | null;
  lastSentAt?: string | Date | null;
  healthScore?: number | null;
};

const SENDABLE: ReadonlySet<MailboxStatus> = new Set(['WARMING', 'ACTIVE']);

const time = (value: string | Date | null | undefined): number => {
  if (!value) return 0;
  const parsed = (typeof value === 'string' ? new Date(value) : value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

// Sequence sends counted against today's cap. A counter from an earlier UTC
// day is stale (the reset cron has not run yet), so it counts as 0.
export const sentTodayFor = (mailbox: SendingMailboxLike, now: Date): number => {
  const last = mailbox.lastSentAt ? new Date(mailbox.lastSentAt) : null;
  if (last) {
    if (Number.isNaN(last.getTime())) return Infinity;
    if (!isSameUtcDay(last, now)) return last < now ? 0 : Infinity;
  }
  const count = mailbox.sentToday ?? 0;
  return Number.isSafeInteger(count) && count >= 0 ? count : Infinity;
};

export const remainingSendsToday = (
  mailbox: SendingMailboxLike,
  now: Date,
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
): number => {
  if (!mailbox.status || !SENDABLE.has(mailbox.status)) return 0;
  return Math.max(0, effectiveDailySendPolicy(mailbox, now, config).dailySendLimit - sentTodayFor(mailbox, now));
};

// Picks the mailbox a sequence email should go out from, or null when every
// mailbox is at its daily cap, paused or broken. Spreads volume: the mailbox
// with the most unused share of its cap wins, then the one idle the longest,
// then the healthiest. Callers must increment sentToday and set lastSentAt
// on the chosen mailbox after a successful send.
export const pickSendingMailbox = <T extends SendingMailboxLike>(
  mailboxes: readonly T[],
  now: Date,
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
): T | null => {
  let best: { mailbox: T; share: number; idleSince: number; health: number } | null = null;

  for (const mailbox of mailboxes) {
    const remaining = remainingSendsToday(mailbox, now, config);
    if (!(remaining > 0)) continue;
    const candidate = {
      mailbox,
      share: remaining / Math.max(1, effectiveDailySendPolicy(mailbox, now, config).dailySendLimit),
      idleSince: time(mailbox.lastSentAt),
      health: mailbox.healthScore ?? 0,
    };
    if (
      !best ||
      candidate.share > best.share ||
      (candidate.share === best.share && candidate.idleSince < best.idleSince) ||
      (candidate.share === best.share && candidate.idleSince === best.idleSince && candidate.health > best.health)
    ) {
      best = candidate;
    }
  }

  return best?.mailbox ?? null;
};
