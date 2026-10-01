import { getConnection } from 'twenty-sdk/logic-function';

import { resolveMailboxAuth } from 'src/gtm/mailbox/auth';
import { resolveWarmupConfig } from 'src/gtm/mailbox/config';
import { warmupTagSecret } from 'src/gtm/mailbox/credentials';
import type { EngineDeps } from 'src/gtm/mailbox/engine';
import { createRestClient, MAILBOX_WARMUP_CONFIG_VARIABLE, readEncryptionKey } from 'src/gtm/mailbox/env';
import { openImapInbox } from 'src/gtm/mailbox/imap-inbox';
import { serverSettingsFor } from 'src/gtm/mailbox/server-settings';
import { createSmtpSender } from 'src/gtm/mailbox/smtp-sender';
import type { MailTransportFactory } from 'src/gtm/mailbox/transport';
import { createTwentyMailboxRepository } from 'src/gtm/mailbox/twenty-repository';

const transports: MailTransportFactory = {
  async sender(mailbox, auth) {
    const settings = serverSettingsFor(mailbox);
    if (!settings) throw new Error('SMTP host is not set');
    return createSmtpSender(settings.smtp, auth);
  },
  async inbox(mailbox, auth) {
    const settings = serverSettingsFor(mailbox);
    if (!settings) throw new Error('IMAP host is not set');
    return openImapInbox(settings.imap, auth);
  },
};

// Real dependencies for the warmup crons: Twenty REST, SMTP, IMAP, OAuth connections.
export const createEngineDeps = (now = new Date()): EngineDeps => {
  const encryptionKey = readEncryptionKey();
  return {
    repo: createTwentyMailboxRepository(createRestClient()),
    transports,
    resolveAuth: (mailbox) =>
      resolveMailboxAuth(mailbox, {
        encryptionKey,
        getAccessToken: async (connectionId) => (await getConnection(connectionId)).accessToken,
      }),
    tagSecret: warmupTagSecret(encryptionKey),
    config: resolveWarmupConfig(process.env[MAILBOX_WARMUP_CONFIG_VARIABLE]),
    now,
    rng: Math.random,
    log: (message) => console.warn(`[warmup] ${message}`),
  };
};
