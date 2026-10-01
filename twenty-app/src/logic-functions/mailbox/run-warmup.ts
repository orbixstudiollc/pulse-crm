import { defineLogicFunction } from 'twenty-sdk/define';

import { MAILBOX_FN_RUN_WARMUP_UID } from 'src/constants/mailbox-ids';
import { runWarmup } from 'src/gtm/mailbox/engine';
import { createEngineDeps } from 'src/gtm/mailbox/runtime';

// Every 20 minutes inside the send window: plan this slice of today's warmup
// sends across the mailbox pool, send them over SMTP and log each one.
// Keep the cron interval in step with runIntervalMinutes in the warmup config.
export default defineLogicFunction({
  universalIdentifier: MAILBOX_FN_RUN_WARMUP_UID,
  name: 'run-warmup',
  description: 'Sends the next slice of warmup emails between your own mailboxes',
  timeoutSeconds: 300,
  cronTriggerSettings: { pattern: '*/20 * * * *' },
  handler: async () => runWarmup(createEngineDeps()),
});
