import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { SEND_APPROVED_CLIENT_EMAIL_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { errorText } from 'src/gtm/agency/runtime';
import { sendApproved } from 'src/logic-functions/agency/send-client-email';

// Sends a client email the moment its Status is set to Approved.
const handler = async (event: DatabaseEventPayload) => {
  const after = (event.properties as { after?: { id?: string; status?: string | null } }).after;
  if (!after?.id || after.status !== 'APPROVED') return { ok: true, skipped: 'Not approved' };
  try {
    return { ok: true, results: await sendApproved([after.id]) };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: SEND_APPROVED_CLIENT_EMAIL_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'send-approved-client-email',
  description: 'Sends a client email when it is approved',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: { eventName: 'clientEmail.updated', updatedFields: ['status'] },
});
