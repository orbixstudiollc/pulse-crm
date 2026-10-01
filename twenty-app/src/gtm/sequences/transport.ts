// How sequences send mail. This module only defines the contract; the
// integrator wires a real implementation (SMTP / Gmail / Microsoft via the
// mailbox + warmup work in src/gtm/mailbox/) in create-mail-transport.ts.
//
// Mailbox choice is separate from sending so the warmup-aware picker
// (`pickSendingMailbox(mailboxes, now)`) can plug in without this code knowing
// about mailboxes. An enrollment sticks to the mailbox that sent its first
// email so follow-ups land in the same thread from the same sender.

export type OutboundEmail = {
  // Mailbox address to send from.
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  // Thread follow-ups onto the first message when the transport supports it.
  inReplyToMessageId?: string | null;
  // For logs, tracking and idempotency keys.
  enrollmentId: string;
  sequenceId: string;
  stepNumber: number;
};

export type SendResult =
  | { ok: true; messageId?: string | null }
  | {
      ok: false;
      error: string;
      // Hard bounce (address does not exist): the enrollment ends as BOUNCED.
      bounced?: boolean;
      // Temporary failure (rate limit, network): retried on a later run.
      retryable?: boolean;
    };

export interface MailTransport {
  send(email: OutboundEmail): Promise<SendResult>;
}

export type MailboxPickContext = {
  now: Date;
  enrollmentId: string;
  sequenceId: string;
};

export interface MailboxPicker {
  // Address of a mailbox that may send right now, or null when every mailbox
  // is at its daily/warmup limit (the send is then deferred, not failed).
  pickMailbox(context: MailboxPickContext): Promise<string | null>;
}

// Optional: called after a successful send so the mailbox side can count it
// toward daily and warmup limits.
export interface MailboxUsageRecorder {
  recordSend(mailboxEmail: string, at: Date): Promise<void>;
}

export type OutreachMailer = {
  transport: MailTransport;
  mailboxes: MailboxPicker;
  usage?: MailboxUsageRecorder;
  sender?: { name?: string | null };
};
