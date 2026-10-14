import { defineLogicFunction } from 'twenty-sdk/define';

import { MAILBOX_FN_RESET_DAILY_COUNTERS_UID } from 'src/constants/mailbox-ids';
import { resolveWarmupConfig } from 'src/gtm/mailbox/config';
import { resetDailyCounters } from 'src/gtm/mailbox/engine';
import { createRestClient, MAILBOX_WARMUP_CONFIG_VARIABLE } from 'src/gtm/mailbox/env';
import { createTwentyMailboxRepository } from 'src/gtm/mailbox/twenty-repository';

// Just after midnight UTC: zero today's counters, advance each mailbox's
// warmup day and stage, recompute its send cap, promote mature mailboxes to
// ACTIVE. Needs no mail credentials.
export default defineLogicFunction({
  universalIdentifier: MAILBOX_FN_RESET_DAILY_COUNTERS_UID,
  name: 'reset-mailbox-daily-counters',
  description: 'Resets daily send counters and moves mailboxes along the warmup ramp',
  timeoutSeconds: 120,
  cronTriggerSettings: { pattern: '5 0 * * *' },
  handler: async () =>
    resetDailyCounters({
      repo: createTwentyMailboxRepository(createRestClient()),
      config: resolveWarmupConfig(process.env[MAILBOX_WARMUP_CONFIG_VARIABLE]),
      now: new Date(),
    }),
});
