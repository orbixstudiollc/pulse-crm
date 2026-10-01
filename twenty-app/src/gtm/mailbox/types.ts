import type { MailboxAuthType, MailboxProvider, MailboxStatus, WarmupStage } from 'src/gtm/mailbox/values';

// A mailbox record as the REST API returns it (fields of the `mailbox` object).
export type MailboxRecord = {
  id: string;
  email: string;
  displayName: string | null;
  provider: MailboxProvider | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  imapHost: string | null;
  imapPort: number | null;
  username: string | null;
  // PASSWORD (sealed app password), OAUTH_CONNECTION or GOOGLE_DELEGATED. Null = inferred.
  authType?: MailboxAuthType | null;
  // Encrypted with MAILBOX_ENCRYPTION_KEY (see credentials.ts). Never plaintext.
  credentialCiphertext: string | null;
  // Optional OAuth app connection id (Google/Microsoft) used instead of a password.
  connectionId: string | null;
  status: MailboxStatus | null;
  warmupEnabled: boolean | null;
  warmupStartedAt: string | null;
  warmupDay: number | null;
  warmupStage: WarmupStage | null;
  dailySendLimit: number | null;
  sentToday: number | null;
  warmupSentToday: number | null;
  lastSentAt: string | null;
  spamPlacementRate: number | null;
  bounceRate: number | null;
  healthScore: number | null;
  lastError: string | null;
};

export type MailboxPatch = Partial<Omit<MailboxRecord, 'id'>>;

export type WarmupMessageRecord = {
  id: string;
  subject: string | null;
  fromMailboxId: string | null;
  toMailboxId: string | null;
  sentAt: string | null;
  messageId: string | null;
  tag: string | null;
  landedInSpam: boolean | null;
  rescued: boolean | null;
  replied: boolean | null;
  bounced: boolean | null;
  processedAt: string | null;
};

export type WarmupMessageInput = Omit<WarmupMessageRecord, 'id'>;
