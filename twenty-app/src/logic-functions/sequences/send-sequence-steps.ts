import { defineLogicFunction } from 'twenty-sdk/define';

import { SEND_SEQUENCE_STEPS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';
import { createOutreachMailer } from 'src/gtm/sequences/create-mail-transport';
import { sendDueSteps } from 'src/gtm/sequences/send-due-steps';
import { createTwentyStore } from 'src/gtm/sequences/twenty-store';

// Every 15 minutes: send each due sequence email (or create the due task) and
// schedule the next step. Batches of 50 keep a run inside the timeout; the
// rest goes out on the next run.
const handler = async () => {
  const mailer = await createOutreachMailer();
  if (!mailer) {
    return { ok: false, mailer: 'not configured', sent: 0 };
  }
  try {
    const summary = await sendDueSteps({ store: createTwentyStore(), mailer, limit: 50 });
    return { ok: summary.failed === 0, ...summary };
  } finally {
    await mailer.close?.();
  }
};

export default defineLogicFunction({
  universalIdentifier: SEND_SEQUENCE_STEPS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'send-sequence-steps',
  description: 'Sends due sequence emails and tasks, then schedules the next step',
  timeoutSeconds: 240,
  handler,
  cronTriggerSettings: { pattern: '*/15 * * * *' },
});
