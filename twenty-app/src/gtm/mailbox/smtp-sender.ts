import { createTransport } from 'nodemailer';

import type { ServerSettings } from 'src/gtm/mailbox/server-settings';
import { MailRejectedError, type MailboxAuth, type MailSender } from 'src/gtm/mailbox/transport';

// MailSender over SMTP with nodemailer. App passwords use LOGIN/PLAIN auth,
// OAuth connections use XOAUTH2 with the connection's access token.
export const createSmtpSender = (settings: ServerSettings['smtp'], auth: MailboxAuth): MailSender => {
  const transporter = createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    requireTLS: !settings.secure,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth:
      auth.type === 'oauth'
        ? { type: 'OAuth2', user: auth.user, accessToken: auth.accessToken }
        : { user: auth.user, pass: auth.password },
  });

  return {
    async send(mail) {
      try {
        const info = await transporter.sendMail({
          from: mail.from.name ? { name: mail.from.name, address: mail.from.email } : mail.from.email,
          to: mail.to.name ? { name: mail.to.name, address: mail.to.email } : mail.to.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          headers: mail.headers,
          inReplyTo: mail.inReplyTo,
          references: mail.references,
        });
        if (Array.isArray(info.rejected) && info.rejected.length > 0) {
          throw new MailRejectedError(`Recipient rejected: ${String(info.rejected[0])}`);
        }
        return { messageId: info.messageId };
      } catch (error) {
        const smtpError = error as { code?: string; responseCode?: number; message?: string };
        if (smtpError.code === 'EENVELOPE' && (smtpError.responseCode ?? 0) >= 500) {
          throw new MailRejectedError(smtpError.message ?? 'Recipient rejected');
        }
        throw error;
      }
    },
    async close() {
      transporter.close();
    },
  };
};
