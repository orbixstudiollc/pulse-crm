// The mailer sendSequenceSteps uses: the workspace's mailboxes (src/gtm/mailbox)
// over SMTP, picked by pickSendingMailbox so sequence volume respects each
// mailbox's warmup stage and daily cap. Returns null when there are no
// mailboxes yet (the cron then reports "not configured").

import { getConnection } from 'twenty-sdk/logic-function';

import { resolveWarmupConfig } from 'src/gtm/mailbox/config';
import { resolveMailboxAuth } from 'src/gtm/mailbox/auth';
import {
  createRestClient,
  MAILBOX_ENCRYPTION_KEY_VARIABLE,
  MAILBOX_WARMUP_CONFIG_VARIABLE,
  readDelegatedTokenSource,
} from 'src/gtm/mailbox/env';
import { GMAIL_SCOPE } from 'src/gtm/mailbox/google-delegation';
import { serverSettingsFor } from 'src/gtm/mailbox/server-settings';
import { createSmtpSender } from 'src/gtm/mailbox/smtp-sender';
import { createTwentyMailboxRepository } from 'src/gtm/mailbox/twenty-repository';
import { openTrackingUrlFrom } from 'src/gtm/sequences/app-variables';
import { buildOutreachMailer } from 'src/gtm/sequences/outreach-mailer';
import type { OutreachMailer } from 'src/gtm/sequences/transport';

export const createOutreachMailer = async (): Promise<OutreachMailer | null> => {
  const repo = createTwentyMailboxRepository(createRestClient());
  const encryptionKey = process.env[MAILBOX_ENCRYPTION_KEY_VARIABLE]?.trim() || undefined;
  const delegated = readDelegatedTokenSource();

  return buildOutreachMailer({
    config: resolveWarmupConfig(process.env[MAILBOX_WARMUP_CONFIG_VARIABLE]),
    listMailboxes: () => repo.listMailboxes(),
    updateMailbox: (id, patch) => repo.updateMailbox(id, patch),
    resolveAuth: (mailbox) =>
      resolveMailboxAuth(mailbox, {
        encryptionKey,
        getAccessToken: async (connectionId) => (await getConnection(connectionId)).accessToken,
        getDelegatedToken: delegated ? (email) => delegated(email, [GMAIL_SCOPE]) : undefined,
      }),
    openSender: async (mailbox, auth) => {
      const settings = serverSettingsFor(mailbox);
      if (!settings) throw new Error('SMTP host is not set');
      return createSmtpSender(settings.smtp, auth);
    },
    openTrackingUrl: openTrackingUrlFrom(process.env.PUBLIC_TWENTY_URL),
    log: (message) => console.warn(`[sequences] ${message}`),
  });
};
