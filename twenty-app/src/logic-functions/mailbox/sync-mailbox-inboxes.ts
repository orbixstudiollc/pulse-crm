import { defineLogicFunction } from 'twenty-sdk/define';

import { MAILBOX_FN_SYNC_INBOXES_UID } from 'src/constants/mailbox-ids';
import { syncMailboxInboxes } from 'src/gtm/mailbox/inbox-sync';
import { createInboxSyncDeps } from 'src/gtm/mailbox/inbox-sync-runtime';

// Every 10 minutes: copy new mail from every mailbox's INBOX into the Inbox
// list (sequence replies are marked and stop the sequence; warmup mail is skipped).
export default defineLogicFunction({
  universalIdentifier: MAILBOX_FN_SYNC_INBOXES_UID,
  name: 'sync-mailbox-inboxes',
  description: 'Copies new mail from every mailbox into the Inbox, marking replies from people in sequences',
  timeoutSeconds: 300,
  cronTriggerSettings: { pattern: '*/10 * * * *' },
  handler: async () => syncMailboxInboxes(createInboxSyncDeps()),
});
