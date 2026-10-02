import { CoreApiClient } from 'twenty-client-sdk/core';
import { getConnection, kv } from 'twenty-sdk/logic-function';

import { resolveMailboxAuth } from 'src/gtm/mailbox/auth';
import { warmupTagSecret } from 'src/gtm/mailbox/credentials';
import { createRestClient, readDelegatedTokenSource, readEncryptionKey } from 'src/gtm/mailbox/env';
import { GMAIL_SCOPE } from 'src/gtm/mailbox/google-delegation';
import { openImapReader } from 'src/gtm/mailbox/imap-reader';
import type { InboxSyncDeps, SyncCursor } from 'src/gtm/mailbox/inbox-sync';
import { serverSettingsFor } from 'src/gtm/mailbox/server-settings';
import { createTwentyMailboxRepository } from 'src/gtm/mailbox/twenty-repository';
import { markReply } from 'src/gtm/sequences/mark-reply';
import { createTwentyStore, type GraphqlClient } from 'src/gtm/sequences/twenty-store';

const cursorKey = (mailboxId: string) => `inbox-sync:${mailboxId}`;

// Real dependencies for the inbox sync cron: Twenty APIs, IMAP, the app's kv store.
export const createInboxSyncDeps = (now = new Date()): InboxSyncDeps => {
  const encryptionKey = readEncryptionKey();
  const delegated = readDelegatedTokenSource();
  const client = new CoreApiClient() as unknown as GraphqlClient;
  const store = createTwentyStore(client);
  return {
    listMailboxes: () => createTwentyMailboxRepository(createRestClient()).listMailboxes(),
    resolveAuth: (mailbox) =>
      resolveMailboxAuth(mailbox, {
        encryptionKey,
        getAccessToken: async (connectionId) => (await getConnection(connectionId)).accessToken,
        getDelegatedToken: delegated ? (email) => delegated(email, [GMAIL_SCOPE]) : undefined,
      }),
    async openReader(mailbox, auth) {
      const settings = serverSettingsFor(mailbox);
      if (!settings) throw new Error('IMAP host is not set');
      return openImapReader(settings.imap, auth);
    },
    getCursor: (mailboxId) => kv.get<SyncCursor>(cursorKey(mailboxId)),
    setCursor: (mailboxId, cursor) => kv.set(cursorKey(mailboxId), cursor),
    recordReply: (email) => markReply({ store, input: email, now }),
    hasItem: (messageId) => store.hasInboxItemForMessage(messageId),
    async createItem(item) {
      await client.mutation({ createInboxItem: { __args: { data: { ...item, kind: 'EMAIL' } }, id: true } });
    },
    tagSecret: warmupTagSecret(encryptionKey),
    now,
    log: (message) => console.warn(`[inbox-sync] ${message}`),
  };
};
