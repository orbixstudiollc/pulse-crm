import type { WarmupConfig } from 'src/gtm/mailbox/config';
import { generateWarmupEmail, generateWarmupReply } from 'src/gtm/mailbox/content';
import { autoPauseReason, computeHealthScore, computePlacementStats } from 'src/gtm/mailbox/health';
import { planWarmupPairs, type WarmupPair } from 'src/gtm/mailbox/pairing';
import {
  dailySendLimitFor,
  sendsThisRun,
  stageForDay,
  warmupDayFor,
  warmupVolumeForDay,
} from 'src/gtm/mailbox/ramp';
import { hasCredential, serverSettingsFor } from 'src/gtm/mailbox/server-settings';
import {
  MailRejectedError,
  type MailboxAuth,
  type MailSender,
  type MailTransportFactory,
} from 'src/gtm/mailbox/transport';
import type {
  MailboxPatch,
  MailboxRecord,
  WarmupMessageInput,
  WarmupMessageRecord,
} from 'src/gtm/mailbox/types';
import { INBOX_CHECK_ERROR_PREFIX, isInboxCheckError } from 'src/gtm/mailbox/types';
import type { MailboxStatus } from 'src/gtm/mailbox/values';
import {
  detectWarmupTag,
  generateWarmupTag,
  WARMUP_TAG_HEADER,
  warmupTagFooter,
  warmupTagPrefix,
} from 'src/gtm/mailbox/warmup-tag';

// Orchestration for the three warmup crons. Everything external (Twenty
// records, SMTP, IMAP, credentials, clock, randomness) is injected, so the
// whole flow runs against fakes in unit tests.

export interface MailboxRepository {
  listMailboxes(): Promise<MailboxRecord[]>;
  updateMailbox(id: string, patch: MailboxPatch): Promise<void>;
  createWarmupMessage(input: WarmupMessageInput): Promise<{ id: string }>;
  findWarmupMessageByTag(tag: string): Promise<WarmupMessageRecord | null>;
  updateWarmupMessage(id: string, patch: Partial<WarmupMessageInput>): Promise<void>;
  listWarmupMessagesSince(since: Date): Promise<WarmupMessageRecord[]>;
}

export type EngineDeps = {
  repo: MailboxRepository;
  transports: MailTransportFactory;
  resolveAuth: (mailbox: MailboxRecord) => Promise<MailboxAuth>;
  tagSecret: string;
  config: WarmupConfig;
  now: Date;
  rng: () => number;
  log?: (message: string) => void;
};

const WARMING_POOL_STATUSES: ReadonlySet<MailboxStatus> = new Set(['WARMING', 'ACTIVE']);
const INBOX_LOOKBACK_DAYS = 3;
const MAX_ERROR_LENGTH = 500;

const errorText = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Mailboxes that take part in warmup: enabled, not paused/broken, reachable.
export const warmupPool = (mailboxes: readonly MailboxRecord[]): MailboxRecord[] =>
  mailboxes.filter(
    (mailbox) =>
      mailbox.warmupEnabled === true &&
      mailbox.status !== null &&
      WARMING_POOL_STATUSES.has(mailbox.status) &&
      Boolean(mailbox.email) &&
      serverSettingsFor(mailbox) !== null &&
      hasCredential(mailbox),
  );

export type RunWarmupSummary = {
  pool: number;
  planned: number;
  sent: number;
  bounced: number;
  failedMailboxes: string[];
};

export const runWarmup = async (deps: EngineDeps): Promise<RunWarmupSummary> => {
  const { repo, config, now, rng } = deps;
  const mailboxes = await repo.listMailboxes();
  const pool = warmupPool(mailboxes);
  const summary: RunWarmupSummary = { pool: pool.length, planned: 0, sent: 0, bounced: 0, failedMailboxes: [] };
  if (pool.length < 2) return summary;

  const byId = new Map(pool.map((mailbox) => [mailbox.id, mailbox]));

  // Today's log is the source of truth for how much each mailbox already sent.
  const today = await repo.listWarmupMessagesSince(startOfUtcDay(now));
  const history: WarmupPair[] = [];
  const sentToday = new Map<string, number>();
  for (const message of today) {
    if (!message.fromMailboxId || !message.toMailboxId) continue;
    history.push({ fromId: message.fromMailboxId, toId: message.toMailboxId });
    sentToday.set(message.fromMailboxId, (sentToday.get(message.fromMailboxId) ?? 0) + 1);
  }

  const quotas = new Map<string, number>();
  for (const mailbox of pool) {
    if (!mailbox.warmupStartedAt) {
      mailbox.warmupStartedAt = now.toISOString();
      await repo.updateMailbox(mailbox.id, { warmupStartedAt: mailbox.warmupStartedAt, warmupDay: 1 });
    }
    const volume = warmupVolumeForDay(warmupDayFor(mailbox.warmupStartedAt, now), config);
    const quota = sendsThisRun(volume - (sentToday.get(mailbox.id) ?? 0), now, config, rng);
    if (quota > 0) quotas.set(mailbox.id, quota);
  }

  const pairs = planWarmupPairs(pool, quotas, rng, history);
  summary.planned = pairs.length;

  const pairsBySender = new Map<string, WarmupPair[]>();
  for (const pair of pairs) {
    pairsBySender.set(pair.fromId, [...(pairsBySender.get(pair.fromId) ?? []), pair]);
  }

  for (const [fromId, senderPairs] of pairsBySender) {
    const from = byId.get(fromId);
    if (!from) continue;
    let sender: MailSender | null = null;
    let sentNow = 0;
    try {
      sender = await deps.transports.sender(from, await deps.resolveAuth(from));
      for (const pair of senderPairs) {
        const to = byId.get(pair.toId);
        if (!to) continue;
        const tag = generateWarmupTag(deps.tagSecret, 'original');
        const content = generateWarmupEmail(rng, to, from);
        const base: WarmupMessageInput = {
          subject: content.subject,
          fromMailboxId: from.id,
          toMailboxId: to.id,
          sentAt: now.toISOString(),
          messageId: null,
          tag,
          landedInSpam: null,
          rescued: null,
          replied: null,
          bounced: false,
          processedAt: null,
        };
        try {
          const result = await sender.send({
            from: { email: from.email, name: from.displayName },
            to: { email: to.email, name: to.displayName },
            subject: content.subject,
            text: `${content.text}\n\n${warmupTagFooter(tag)}`,
            headers: { [WARMUP_TAG_HEADER]: tag },
          });
          await repo.createWarmupMessage({ ...base, messageId: result.messageId });
          summary.sent++;
          sentNow++;
        } catch (error) {
          if (!(error instanceof MailRejectedError)) throw error;
          await repo.createWarmupMessage({ ...base, bounced: true });
          summary.bounced++;
          sentNow++;
        }
      }
      const patch: MailboxPatch = { warmupSentToday: (sentToday.get(fromId) ?? 0) + sentNow };
      if (from.lastError) patch.lastError = null;
      await repo.updateMailbox(fromId, patch);
    } catch (error) {
      summary.failedMailboxes.push(from.email);
      deps.log?.(`warmup send failed for ${from.email}: ${errorText(error)}`);
      await repo.updateMailbox(fromId, {
        status: 'ERROR',
        lastError: `Sending failed: ${errorText(error)}`,
        warmupSentToday: (sentToday.get(fromId) ?? 0) + sentNow,
      });
    } finally {
      await sender?.close().catch(() => undefined);
    }
  }

  return summary;
};

export type ProcessInboxesSummary = {
  mailboxes: number;
  found: number;
  rescued: number;
  replied: number;
  failedMailboxes: string[];
  paused: string[];
};

export const processWarmupInboxes = async (deps: EngineDeps): Promise<ProcessInboxesSummary> => {
  const { repo, config, now, rng } = deps;
  const mailboxes = await repo.listMailboxes();
  const pool = warmupPool(mailboxes);
  const byEmail = new Map(mailboxes.map((mailbox) => [mailbox.email.toLowerCase(), mailbox]));
  const byId = new Map(mailboxes.map((mailbox) => [mailbox.id, mailbox]));
  const summary: ProcessInboxesSummary = { mailboxes: pool.length, found: 0, rescued: 0, replied: 0, failedMailboxes: [], paused: [] };
  const prefix = warmupTagPrefix(deps.tagSecret);
  const since = new Date(now.getTime() - INBOX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  for (const mailbox of pool) {
    let inbox: Awaited<ReturnType<MailTransportFactory['inbox']>> | null = null;
    let replySender: MailSender | null = null;
    try {
      const auth = await deps.resolveAuth(mailbox);
      inbox = await deps.transports.inbox(mailbox, auth);
      const messages = await inbox.findTagged(prefix, since);

      for (const message of messages) {
        const detected = detectWarmupTag(deps.tagSecret, message);
        if (!detected) continue;
        summary.found++;

        const record = await repo.findWarmupMessageByTag(detected.tag);
        const landedInSpam = message.folder === 'SPAM';
        // Flag first: moving changes the message's UID, and flags travel with it.
        await inbox.markReadAndImportant(message);
        if (landedInSpam) {
          await inbox.rescue(message);
          summary.rescued++;
        }

        let replied = false;
        const originalSender =
          (record?.fromMailboxId ? byId.get(record.fromMailboxId) : undefined) ??
          (message.fromEmail ? byEmail.get(message.fromEmail.toLowerCase()) : undefined);

        if (detected.kind === 'original' && originalSender && rng() < config.replyRate) {
          replySender ??= await deps.transports.sender(mailbox, auth);
          const tag = generateWarmupTag(deps.tagSecret, 'reply');
          const content = generateWarmupReply(rng, message.subject, mailbox);
          const result = await replySender.send({
            from: { email: mailbox.email, name: mailbox.displayName },
            to: { email: originalSender.email, name: originalSender.displayName },
            subject: content.subject,
            text: `${content.text}\n\n${warmupTagFooter(tag)}`,
            headers: { [WARMUP_TAG_HEADER]: tag },
            inReplyTo: message.messageId ?? undefined,
            references: message.messageId ? [message.messageId] : undefined,
          });
          await repo.createWarmupMessage({
            subject: content.subject,
            fromMailboxId: mailbox.id,
            toMailboxId: originalSender.id,
            sentAt: now.toISOString(),
            messageId: result.messageId,
            tag,
            landedInSpam: null,
            rescued: null,
            replied: null,
            bounced: false,
            processedAt: null,
          });
          replied = true;
          summary.replied++;
        }

        if (record) {
          await repo.updateWarmupMessage(record.id, {
            processedAt: now.toISOString(),
            landedInSpam,
            rescued: landedInSpam,
            replied,
          });
        }
      }
      // The inbox opened, so an earlier sign-in failure no longer applies.
      if (isInboxCheckError(mailbox.lastError)) {
        await repo.updateMailbox(mailbox.id, { lastError: null });
        mailbox.lastError = null;
      }
    } catch (error) {
      summary.failedMailboxes.push(mailbox.email);
      deps.log?.(`warmup inbox failed for ${mailbox.email}: ${errorText(error)}`);
      await repo.updateMailbox(mailbox.id, { status: 'ERROR', lastError: `${INBOX_CHECK_ERROR_PREFIX}${errorText(error)}` });
      mailbox.status = 'ERROR';
    } finally {
      await inbox?.close().catch(() => undefined);
      await replySender?.close().catch(() => undefined);
    }
  }

  summary.paused = await refreshMailboxStats(deps, mailboxes);
  return summary;
};

// Recomputes spam placement, bounce rate, health and the send cap for every
// mailbox from the warmup log, and pauses mailboxes that are burning.
// Returns the emails of mailboxes it paused.
export const refreshMailboxStats = async (
  deps: Pick<EngineDeps, 'repo' | 'config' | 'now'>,
  mailboxes: readonly MailboxRecord[],
): Promise<string[]> => {
  const { repo, config, now } = deps;
  const since = new Date(now.getTime() - config.statsWindowDays * 24 * 60 * 60 * 1000);
  const log = await repo.listWarmupMessagesSince(since);
  const paused: string[] = [];

  for (const mailbox of mailboxes) {
    const stats = computePlacementStats(
      log.filter((message) => message.fromMailboxId === mailbox.id),
      now,
      config.statsWindowDays,
    );
    let status: MailboxStatus = mailbox.status ?? 'WARMING';
    let lastError = mailbox.lastError;
    const reason = status === 'PAUSED' ? null : autoPauseReason(stats, config);
    if (reason) {
      status = 'PAUSED';
      lastError = `Auto-paused: ${reason}`;
      paused.push(mailbox.email);
    }
    const healthScore = computeHealthScore({
      spamPlacementRate: stats.spamPlacementRate,
      bounceRate: stats.bounceRate,
      status,
      hasRecentError: Boolean(lastError) && status === 'ERROR',
    });
    const stage = mailbox.warmupStage ?? 'STARTING';
    const patch: MailboxPatch = {
      spamPlacementRate: stats.spamPlacementRate,
      bounceRate: stats.bounceRate,
      healthScore,
      dailySendLimit: dailySendLimitFor({ stage, status, healthScore }, config),
    };
    if (status !== mailbox.status) patch.status = status;
    if (lastError !== mailbox.lastError) patch.lastError = lastError;
    await repo.updateMailbox(mailbox.id, patch);
  }

  return paused;
};

// Daily rollover: zero the counters and move each mailbox along the ramp.
// A warming mailbox becomes ACTIVE when it reaches the MATURE stage.
export const resetDailyCounters = async (
  deps: Pick<EngineDeps, 'repo' | 'config' | 'now'>,
): Promise<{ updated: number; promoted: string[] }> => {
  const { repo, config, now } = deps;
  const mailboxes = await repo.listMailboxes();
  const promoted: string[] = [];

  for (const mailbox of mailboxes) {
    let warmupStartedAt = mailbox.warmupStartedAt;
    if (!warmupStartedAt && mailbox.warmupEnabled && mailbox.status === 'WARMING') {
      warmupStartedAt = now.toISOString();
    }
    const day = warmupStartedAt ? warmupDayFor(warmupStartedAt, now) : (mailbox.warmupDay ?? 0);
    const stage = warmupStartedAt ? stageForDay(day, config) : (mailbox.warmupStage ?? 'STARTING');
    let status: MailboxStatus = mailbox.status ?? 'WARMING';
    if (status === 'WARMING' && stage === 'MATURE') {
      status = 'ACTIVE';
      promoted.push(mailbox.email);
    }
    const patch: MailboxPatch = {
      sentToday: 0,
      warmupSentToday: 0,
      warmupDay: day,
      warmupStage: stage,
      dailySendLimit: dailySendLimitFor({ stage, status, healthScore: mailbox.healthScore }, config),
    };
    if (warmupStartedAt !== mailbox.warmupStartedAt) patch.warmupStartedAt = warmupStartedAt;
    if (status !== mailbox.status) patch.status = status;
    await repo.updateMailbox(mailbox.id, patch);
  }

  return { updated: mailboxes.length, promoted };
};
