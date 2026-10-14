import { DEFAULT_WARMUP_CONFIG, type WarmupConfig } from 'src/gtm/mailbox/config';
import type { MailboxStatus, WarmupStage } from 'src/gtm/mailbox/values';

const DAY_MS = 24 * 60 * 60 * 1000;

const utcDayStart = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

export const isSameUtcDay = (a: Date, b: Date): boolean => utcDayStart(a) === utcDayStart(b);

// Day of warmup (1-based) for a mailbox that started warming on startedAt.
// Returns 0 before the start date or when there is no start date.
export const warmupDayFor = (startedAt: Date | string | null | undefined, now: Date): number => {
  if (!startedAt) return 0;
  const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  if (Number.isNaN(start.getTime())) return 0;
  const diff = Math.floor((utcDayStart(now) - utcDayStart(start)) / DAY_MS);
  return diff < 0 ? 0 : diff + 1;
};

// Warmup emails a mailbox should send on a given warmup day. Linear from
// startVolume on day 1 to maxVolume on rampDays, flat after that.
export const warmupVolumeForDay = (
  day: number,
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
): number => {
  if (day <= 0) return 0;
  if (day >= config.rampDays || config.rampDays <= 1) return config.maxVolume;
  const progress = (day - 1) / (config.rampDays - 1);
  return Math.round(config.startVolume + (config.maxVolume - config.startVolume) * progress);
};

// The full ramp, for display or for checking a config.
export const rampSchedule = (
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
  days = config.rampDays + 7,
): { day: number; volume: number; stage: WarmupStage }[] =>
  Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    return { day, volume: warmupVolumeForDay(day, config), stage: stageForDay(day, config) };
  });

export const stageForDay = (
  day: number,
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
): WarmupStage => {
  const [building, ramping, mature] = config.stageStartDays;
  if (day >= mature) return 'MATURE';
  if (day >= ramping) return 'RAMPING';
  if (day >= building) return 'BUILDING';
  return 'STARTING';
};

// Daily cap on sequence sends. Follows the warmup stage; paused or broken
// mailboxes get 0, and a poor health score halves the cap.
export const dailySendLimitFor = (
  input: { stage: WarmupStage; status: MailboxStatus; healthScore?: number | null },
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
): number => {
  if (input.status === 'PAUSED' || input.status === 'ERROR') return 0;
  const base = config.stageSendLimits[input.stage] ?? 0;
  if (typeof input.healthScore === 'number' && input.healthScore < config.lowHealthScore) {
    return Math.floor(base / 2);
  }
  return base;
};

// Shared sequence policy. The stored dailySendLimit is only a display cache:
// recompute from owner intent and warmup/health at refresh, selection and send.
export type DailySendPolicyInput = {
  configuredDailySendLimit?: number | null;
  warmupStage?: WarmupStage | null;
  warmupStartedAt?: string | null;
  status: MailboxStatus | null;
  healthScore?: number | null;
};

export const effectiveDailySendPolicy = (
  input: DailySendPolicyInput,
  now: Date,
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
): { dailySendLimit: number; dailySendLimitReason: string } => {
  const hold = (dailySendLimitReason: string) => ({ dailySendLimit: 0, dailySendLimitReason });
  if (!Number.isFinite(now.getTime())) return hold('Invalid clock; outreach on hold');
  if (input.warmupStartedAt && !Number.isFinite(new Date(input.warmupStartedAt).getTime())) {
    return hold('Invalid warmup start date; outreach on hold');
  }
  if (input.status !== 'WARMING' && input.status !== 'ACTIVE') {
    return hold(`Mailbox ${input.status ?? 'status missing'}; outreach on hold`);
  }
  const maximum = input.configuredDailySendLimit;
  if (typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 0) {
    return hold('Set Your daily maximum to a non-negative whole number; outreach on hold');
  }
  if (maximum === 0) return hold('Your daily maximum is 0; outreach on hold');
  if (input.healthScore != null && (!Number.isFinite(input.healthScore) || input.healthScore < 0 || input.healthScore > 100)) {
    return hold('Invalid health score; outreach on hold');
  }
  // A known start date takes precedence over a stale/manually edited stage.
  const stage = input.warmupStartedAt
    ? stageForDay(warmupDayFor(input.warmupStartedAt, now), config)
    : (input.warmupStage ?? 'STARTING');
  const allowance = dailySendLimitFor({ stage, status: input.status, healthScore: input.healthScore }, config);
  if (!Number.isFinite(allowance) || allowance < 0) return hold('Invalid warmup allowance; outreach on hold');
  const effective = Math.min(maximum, Math.floor(allowance));
  const health = typeof input.healthScore === 'number' && input.healthScore < config.lowHealthScore
    ? '; reduced for low health' : '';
  const firstEligible = (['STARTING', 'BUILDING', 'RAMPING', 'MATURE'] as const)
    .find((candidate) => config.stageSendLimits[candidate] >= 1);
  const next = effective === 0 && stage === 'STARTING' && firstEligible
    ? `; first eligible stage ${firstEligible}` : '';
  return {
    dailySendLimit: effective,
    dailySendLimitReason: `Your maximum ${maximum}; warmup ${stage} allowance ${Math.floor(allowance)}${health}${next}`,
  };
};

// How many cron runs are still to come today inside the send window,
// counting the current one. 0 outside the window.
export const runsLeftInWindow = (now: Date, config: WarmupConfig = DEFAULT_WARMUP_CONFIG): number => {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const start = config.sendWindowStartHourUtc * 60;
  const end = config.sendWindowEndHourUtc * 60;
  if (minutes < start || minutes >= end) return 0;
  return Math.max(1, Math.ceil((end - minutes) / config.runIntervalMinutes));
};

// Warmup emails to send in this run so the day's remainder is spread evenly
// over the runs left. rng adds jitter so sends do not look clockwork.
export const sendsThisRun = (
  remainingToday: number,
  now: Date,
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
  rng: () => number = Math.random,
): number => {
  if (remainingToday <= 0) return 0;
  const runsLeft = runsLeftInWindow(now, config);
  if (runsLeft === 0) return 0;
  if (runsLeft === 1) return remainingToday;
  const exact = remainingToday / runsLeft;
  const base = Math.floor(exact);
  const extra = rng() < exact - base ? 1 : 0;
  return Math.min(remainingToday, base + extra);
};
