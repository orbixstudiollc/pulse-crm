import type { MailboxRecord } from 'src/gtm/mailbox/types';
import type { MailboxProvider } from 'src/gtm/mailbox/values';

export type ServerSettings = {
  smtp: { host: string; port: number; secure: boolean };
  imap: { host: string; port: number; secure: boolean };
};

// Defaults when the record leaves host/port empty.
const PROVIDER_DEFAULTS: Partial<Record<MailboxProvider, ServerSettings>> = {
  GOOGLE: {
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
  },
  MICROSOFT: {
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
  },
};

// SMTP/IMAP settings for a mailbox, or null when they cannot be worked out.
// Port 465 implies implicit TLS; other ports upgrade with STARTTLS unless
// smtpSecure is set explicitly.
export const serverSettingsFor = (
  mailbox: Pick<MailboxRecord, 'provider' | 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'imapHost' | 'imapPort'>,
): ServerSettings | null => {
  const defaults = mailbox.provider ? PROVIDER_DEFAULTS[mailbox.provider] : undefined;
  const smtpHost = mailbox.smtpHost?.trim() || defaults?.smtp.host;
  const imapHost = mailbox.imapHost?.trim() || defaults?.imap.host;
  if (!smtpHost || !imapHost) return null;
  const smtpPort = mailbox.smtpPort || defaults?.smtp.port || 587;
  const imapPort = mailbox.imapPort || defaults?.imap.port || 993;
  return {
    smtp: { host: smtpHost, port: smtpPort, secure: mailbox.smtpSecure ?? smtpPort === 465 },
    imap: { host: imapHost, port: imapPort, secure: imapPort !== 143 },
  };
};

export const hasCredential = (mailbox: Pick<MailboxRecord, 'credentialCiphertext' | 'connectionId'>): boolean =>
  Boolean(mailbox.credentialCiphertext?.trim() || mailbox.connectionId?.trim());
