// Builds the OutreachMailer the sequence sender uses on top of the mailbox
// area: warmup-aware picking, per-mailbox auth and SMTP, and the shared daily
// cap (sentToday / lastSentAt). Dependencies are injected so this file pulls
// in no nodemailer and can be tested with fakes; create-mail-transport.ts
// wires the real ones.

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
): T | null => {
  const own = preferred ? mailboxes.find((m) => sameEmail(m.email, preferred)) : undefined;
  if (own && own.status && SENDABLE.has(own.status)) {
    return remainingSendsToday(own, now) > 0 ? own : null;
  }
  return pickSendingMailbox(mailboxes, now);
};

export const buildOutreachMailer = async (
  deps: OutreachMailerDeps,
): Promise<OutreachMailer | null> => {
  const mailboxes = await deps.listMailboxes();
  if (mailboxes.length === 0) return null;

  const byEmail = (email: string) => mailboxes.find((m) => sameEmail(m.email, email));
  const senders = new Map<string, MailSender>();

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
        return pickMailboxForEnrollment(mailboxes, preferred, now)?.email ?? null;
      },
    },

    transport: {
      async send(email): Promise<SendResult> {
        const mailbox = byEmail(email.from);
        if (!mailbox) return { ok: false, error: `No mailbox ${email.from}`, retryable: true };

        let sender: MailSender;
        try {
          sender = await senderFor(mailbox);
        } catch (error) {
          await markError(mailbox, `Sign-in failed: ${errorText(error)}`);
          return { ok: false, error: `Mailbox ${mailbox.email} unavailable: ${errorText(error)}`, retryable: true };
        }

        try {
          const result = await sender.send({
            from: { email: mailbox.email, name: mailbox.displayName },
            to: { email: email.to },
            subject: email.subject,
            text: email.text,
            html: email.html,
            inReplyTo: email.inReplyToMessageId ?? undefined,
            references: email.inReplyToMessageId ? [email.inReplyToMessageId] : undefined,
          });
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
        const patch = { sentToday: sentTodayFor(mailbox, at) + 1, lastSentAt: at.toISOString() };
        Object.assign(mailbox, patch);
        await deps.updateMailbox(mailbox.id, patch);
      },
    },

    async close() {
      await Promise.all([...senders.values()].map((s) => s.close().catch(() => undefined)));
      senders.clear();
    },
  };
};
