import type { WarmupStage } from 'src/gtm/mailbox/values';

// Every knob of the warmup engine. Defaults follow the plan: about 2 warmup
// emails a day, rising to around 40 over 3 to 4 weeks. Override any of them
// with the MAILBOX_WARMUP_CONFIG application variable (JSON).
export type WarmupConfig = {
  // Warmup emails a mailbox sends on day 1.
  startVolume: number;
  // Warmup emails a mailbox sends once the ramp is done.
  maxVolume: number;
  // Day on which maxVolume is reached (day 1 = first day of warmup).
  rampDays: number;
  // First day of each stage after STARTING: [BUILDING, RAMPING, MATURE].
  stageStartDays: [number, number, number];
  // Daily cap for sequence (cold) sends in each stage.
  stageSendLimits: Record<WarmupStage, number>;
  // Share of received warmup emails that get a reply.
  replyRate: number;
  // UTC hours between which warmup emails go out, [start, end).
  sendWindowStartHourUtc: number;
  sendWindowEndHourUtc: number;
  // How often the runWarmup cron fires, in minutes. Used to spread sends.
  runIntervalMinutes: number;
  // Trailing window for spam-placement and bounce rates.
  statsWindowDays: number;
  // Minimum processed warmup emails before rates can auto-pause a mailbox.
  minSampleForAutoPause: number;
  // Auto-pause thresholds.
  autoPauseSpamRate: number;
  autoPauseBounceRate: number;
  // Below this health score the sequence send cap is halved.
  lowHealthScore: number;
};

export const DEFAULT_WARMUP_CONFIG: WarmupConfig = {
  startVolume: 2,
  maxVolume: 40,
  rampDays: 24,
  stageStartDays: [8, 15, 22],
  stageSendLimits: { STARTING: 0, BUILDING: 10, RAMPING: 25, MATURE: 40 },
  replyRate: 0.35,
  sendWindowStartHourUtc: 7,
  sendWindowEndHourUtc: 19,
  runIntervalMinutes: 20,
  statsWindowDays: 14,
  minSampleForAutoPause: 10,
  autoPauseSpamRate: 0.35,
  autoPauseBounceRate: 0.08,
  lowHealthScore: 50,
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// Merge a partial override (object or JSON string) over the defaults. Unknown
// keys and wrongly typed values are ignored, so a bad variable never breaks a run.
export const resolveWarmupConfig = (override?: unknown): WarmupConfig => {
  let raw: unknown = override;

  if (typeof raw === 'string') {
    if (raw.trim() === '') return { ...DEFAULT_WARMUP_CONFIG };
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_WARMUP_CONFIG };
    }
  }

  const config: WarmupConfig = {
    ...DEFAULT_WARMUP_CONFIG,
    stageSendLimits: { ...DEFAULT_WARMUP_CONFIG.stageSendLimits },
    stageStartDays: [...DEFAULT_WARMUP_CONFIG.stageStartDays],
  };

  if (raw === null || typeof raw !== 'object') return config;
  const input = raw as Record<string, unknown>;

  for (const key of Object.keys(DEFAULT_WARMUP_CONFIG) as (keyof WarmupConfig)[]) {
    const value = input[key];
    if (key === 'stageSendLimits') {
      if (value && typeof value === 'object') {
        for (const [stage, limit] of Object.entries(value)) {
          if (stage in config.stageSendLimits && isFiniteNumber(limit) && limit >= 0) {
            config.stageSendLimits[stage as WarmupStage] = limit;
          }
        }
      }
    } else if (key === 'stageStartDays') {
      if (
        Array.isArray(value) &&
        value.length === 3 &&
        value.every(isFiniteNumber) &&
        value[0] < value[1] &&
        value[1] < value[2]
      ) {
        config.stageStartDays = [value[0], value[1], value[2]];
      }
    } else if (isFiniteNumber(value) && value >= 0) {
      (config as Record<string, unknown>)[key] = value;
    }
  }

  config.rampDays = Math.max(1, config.rampDays);
  config.maxVolume = Math.max(config.startVolume, config.maxVolume);
  config.runIntervalMinutes = Math.max(1, config.runIntervalMinutes);
  config.replyRate = Math.min(1, config.replyRate);

  return config;
};
