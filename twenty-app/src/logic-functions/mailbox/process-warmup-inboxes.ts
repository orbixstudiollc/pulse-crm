import { defineLogicFunction } from 'twenty-sdk/define';

import { MAILBOX_FN_PROCESS_WARMUP_INBOXES_UID } from 'src/constants/mailbox-ids';
import { processWarmupInboxes } from 'src/gtm/mailbox/engine';
import { createEngineDeps } from 'src/gtm/mailbox/runtime';

// Twice an hour: over IMAP, find tagged warmup mail in every pool mailbox,
// move it out of spam, mark it read and important, reply to a share of it,
// then refresh spam placement, bounce rate, health and send caps.
export default defineLogicFunction({
  universalIdentifier: MAILBOX_FN_PROCESS_WARMUP_INBOXES_UID,
  name: 'process-warmup-inboxes',
  description: 'Rescues warmup mail from spam, marks it important, replies, and updates mailbox health',
  timeoutSeconds: 300,
  cronTriggerSettings: { pattern: '10,40 * * * *' },
  handler: async () => processWarmupInboxes(createEngineDeps()),
});
