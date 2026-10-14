// Builds the OutreachMailer the sequence sender uses on top of the mailbox
// area: warmup-aware picking, per-mailbox auth and SMTP, and the shared daily
// cap (sentToday / lastSentAt). Dependencies are injected so this file pulls
// in no nodemailer and can be tested with fakes; create-mail-transport.ts
// wires the real ones.

import { DEFAULT_WARMUP_CONFIG, type WarmupConfig } from 'src/gtm/mailbox/config';
import { pickSendingMailbox, remainingSendsToday, sentTodayFor } from 'src/gtm/mailbox';
import {
  MailRejectedError,
  type MailboxAuth,
  type MailSender,
} from 'src/gtm/mailbox/transport';
import type { MailboxPatch, MailboxRecord } from 'src/gtm/mailbox/types';
import type { OutreachMailer, SendResult } from 'src/gtm/sequences/transport';

export type OutreachMailerDeps = {
  listMailboxes(): Promise<MailboxRecord[]>;
  updateMailbox(id: string, patch: MailboxPatch): Promise<void>;
  resolveAuth(mailbox: MailboxRecord): Promise<MailboxAuth>;
  openSender(mailbox: MailboxRecord, auth: MailboxAuth): Promise<MailSender>;
  config?: WarmupConfig;
  now?: () => Date;
  openTrackingUrl?: string | null;
  log?: (message: string) => void;
};

const SENDABLE = new Set(['WARMING', 'ACTIVE']);
const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 500);

// Mailbox for one send. An enrollment keeps its own mailbox while that mailbox
// can still send (waiting when it is only full for today, so the thread stays
// with one sender); it moves to another mailbox only when its own is gone,
// paused or broken.
export const pickMailboxForEnrollment = <T extends MailboxRecord>(
  mailboxes: readonly T[],
  preferred: string | null | undefined,
  now: Date,
  config: WarmupConfig = DEFAULT_WARMUP_CONFIG,
): T | null => {
  const own = preferred ? mailboxes.find((m) => sameEmail(m.email, preferred)) : undefined;
  if (own && own.status && SENDABLE.has(own.status)) {
    return remainingSendsToday(own, now, config) > 0 ? own : null;
  }
  return pickSendingMailbox(mailboxes, now, config);
};

export const buildOutreachMailer = async (
  deps: OutreachMailerDeps,
): Promise<OutreachMailer | null> => {
  let mailboxes = await deps.listMailboxes();
  const config = deps.config ?? DEFAULT_WARMUP_CONFIG;
  const now = deps.now ?? (() => new Date());
  if (mailboxes.length === 0) return null;

  const byEmail = (email: string) => mailboxes.find((m) => sameEmail(m.email, email));
  const senders = new Map<string, MailSender>();
  type Usage = { sentToday: number; lastSentAt: string };
  const localUsage = new Map<string, Usage>();
  const pendingUsage = new Map<string, Usage>();
  const usageFailed = new Set<string>();

  // A stale server read must not undo a send already observed in this run.
  const retainLocalUsage = (mailbox: MailboxRecord, at: Date) => {
    const local = localUsage.get(mailbox.id);
    if (local && sentTodayFor({ ...mailbox, ...local }, at) > sentTodayFor(mailbox, at)) {
      Object.assign(mailbox, local);
    }
  };

  // Marks a mailbox broken for this run and in Twenty, like the warmup engine.
  const markError = async (mailbox: MailboxRecord, message: string) => {
    mailbox.status = 'ERROR';
    mailbox.lastError = message;
    deps.log?.(`sequence mailbox ${mailbox.email}: ${message}`);
    await deps.updateMailbox(mailbox.id, { status: 'ERROR', lastError: message });
  };

  const senderFor = async (mailbox: MailboxRecord): Promise<MailSender> => {
    const cached = senders.get(mailbox.id);
    if (cached) return cached;
    const sender = await deps.openSender(mailbox, await deps.resolveAuth(mailbox));
    senders.set(mailbox.id, sender);
    return sender;
  };

  return {
    openTrackingUrl: deps.openTrackingUrl ?? null,
    senderNameFor: (email) => byEmail(email)?.displayName ?? null,

    mailboxes: {
      async pickMailbox({ now, preferred }) {
        for (const mailbox of mailboxes) retainLocalUsage(mailbox, now);
        // A quota persistence failure holds this run, including preferred senders.
        const eligible = mailboxes.map((m) => usageFailed.has(m.id) ? { ...m, configuredDailySendLimit: 0 } : m);
        return pickMailboxForEnrollment(eligible, preferred, now, config)?.email ?? null;
      },
    },

    transport: {
      async send(email): Promise<SendResult> {
        // Re-read owner/status/health/usage so an edit since selection is honored.
        // Failure to refresh is a hold, never permission to use a cached cap.
        try {
          mailboxes = await deps.listMailboxes();
        } catch (error) {
          return { ok: false, error: `Cannot verify mailbox policy: ${errorText(error)}`, retryable: true };
        }
        const mailbox = byEmail(email.from);
        if (!mailbox) return { ok: false, error: `No mailbox ${email.from}`, retryable: true };

        retainLocalUsage(mailbox, now());
        if (usageFailed.has(mailbox.id) || !(remainingSendsToday(mailbox, now(), config) > 0)) {
          return { ok: false, error: `Mailbox ${mailbox.email} is at its effective cap or on hold`, retryable: true };
        }

        let sender: MailSender;
        try {
          sender = await senderFor(mailbox);
        } catch (error) {
          await markError(mailbox, `Sign-in failed: ${errorText(error)}`);
          return { ok: false, error: `Mailbox ${mailbox.email} unavailable: ${errorText(error)}`, retryable: true };
        }

        try {
          if (!(remainingSendsToday(mailbox, now(), config) > 0)) {
            return { ok: false, error: `Mailbox ${mailbox.email} is at its effective cap or on hold`, retryable: true };
          }
          const result = await sender.send({
            from: { email: mailbox.email, name: mailbox.displayName },
            to: { email: email.to },
            subject: email.subject,
            text: email.text,
            html: email.html,
            inReplyTo: email.inReplyToMessageId ?? undefined,
            references: email.inReplyToMessageId ? [email.inReplyToMessageId] : undefined,
          });
          // SMTP may finish after midnight; charge the completion day.
          const sentAt = now();
          const usage = { sentToday: sentTodayFor(mailbox, sentAt) + 1, lastSentAt: sentAt.toISOString() };
          localUsage.set(mailbox.id, usage);
          pendingUsage.set(mailbox.id, usage);
          Object.assign(mailbox, usage);
          return { ok: true, messageId: result.messageId };
        } catch (error) {
          if (error instanceof MailRejectedError) {
            return { ok: false, error: errorText(error), bounced: true };
          }
          return { ok: false, error: errorText(error), retryable: true };
        }
      },
    },

    usage: {
      // Counts the send against the mailbox's daily cap (shared with the
      // picker, so the next pick in this run already sees it).
      async recordSend(mailboxEmail, at) {
        const mailbox = byEmail(mailboxEmail);
        if (!mailbox) return;
        // The runner's timestamp may predate midnight; charge the actual send day.
        const patch = pendingUsage.get(mailbox.id)
          ?? { sentToday: sentTodayFor(mailbox, at) + 1, lastSentAt: at.toISOString() };
        pendingUsage.delete(mailbox.id);
        localUsage.set(mailbox.id, patch);
        Object.assign(mailbox, patch);
        try {
          await deps.updateMailbox(mailbox.id, patch);
        } catch (error) {
          usageFailed.add(mailbox.id);
          throw error;
        }
      },
    },

    async close() {
      await Promise.all([...senders.values()].map((s) => s.close().catch(() => undefined)));
      senders.clear();
    },
  };
};
