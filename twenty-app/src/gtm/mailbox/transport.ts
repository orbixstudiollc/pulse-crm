import type { MailboxRecord } from 'src/gtm/mailbox/types';

// The engine talks to mail servers only through these interfaces. The real
// implementations (nodemailer over SMTP, imapflow over IMAP) live in
// smtp-sender.ts and imap-inbox.ts; tests use in-memory fakes.

export type MailboxAuth =
  | { type: 'password'; user: string; password: string }
  | { type: 'oauth'; user: string; accessToken: string };

export type OutgoingMail = {
  from: { email: string; name?: string | null };
  to: { email: string; name?: string | null };
  subject: string;
  text: string;
  // Optional HTML alternative (sequence emails; warmup sends text only).
  html?: string;
  headers?: Record<string, string>;
  inReplyTo?: string;
  references?: string[];
};

export type SendResult = { messageId: string };

// Raised by senders when the server rejects the recipient (a hard bounce).
export class MailRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailRejectedError';
  }
}

export interface MailSender {
  send(mail: OutgoingMail): Promise<SendResult>;
  close(): Promise<void>;
}

export type InboxFolder = 'INBOX' | 'SPAM';

export type InboxMessage = {
  uid: number;
  folder: InboxFolder;
  messageId: string | null;
  subject: string;
  fromEmail: string | null;
  headers: Record<string, string>;
  text: string;
};

export interface WarmupInbox {
  // Unread messages in INBOX and the spam folder since `since` whose headers
  // or body contain `tagPrefix`. Implementations may over-match; the engine
  // verifies every tag.
  findTagged(tagPrefix: string, since: Date): Promise<InboxMessage[]>;
  // Mark read and important (flagged / Gmail \Important). Called before rescue.
  markReadAndImportant(message: InboxMessage): Promise<void>;
  // Move a message out of spam into INBOX.
  rescue(message: InboxMessage): Promise<void>;
  close(): Promise<void>;
}

export interface MailTransportFactory {
  sender(mailbox: MailboxRecord, auth: MailboxAuth): Promise<MailSender>;
  inbox(mailbox: MailboxRecord, auth: MailboxAuth): Promise<WarmupInbox>;
}
