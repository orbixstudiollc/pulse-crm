import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { SEND_CLIENT_EMAIL_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { findStuckApproved, sendClientEmail } from 'src/gtm/agency/send-client-email';
import { agencyMailer, agencyRecords, agencySettings, errorText } from 'src/gtm/agency/runtime';

type Row = { id?: string; status?: string | null };

// Sends a client email created as Approved (auto-send on), and every few
// minutes picks up approved emails a trigger missed.
export const sendApproved = async (ids: string[]) => {
  const records = agencyRecords();
  const mailer = await agencyMailer(records, agencySettings());
  const results = [];
  for (const id of ids) results.push({ id, ...(await sendClientEmail({ records, mailer, id })) });
  return results;
};

const handler = async (event?: DatabaseEventPayload) => {
  try {
    const after = (event?.properties as { after?: Row } | undefined)?.after;
    if (after?.id) {
      if (after.status !== 'APPROVED') return { ok: true, skipped: 'Not approved' };
      return { ok: true, results: await sendApproved([after.id]) };
    }
    const stuck = await findStuckApproved(agencyRecords(), new Date());
    return { ok: true, results: await sendApproved(stuck.map((r) => r.id)) };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: SEND_CLIENT_EMAIL_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'send-client-email',
  description: 'Sends client emails created as Approved, and retries approved ones a trigger missed',
  timeoutSeconds: 120,
  handler,
  databaseEventTriggerSettings: { eventName: 'clientEmail.created' },
  cronTriggerSettings: { pattern: '*/15 * * * *' },
});
