import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { DETECT_SEQUENCE_REPLIES_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';
import { fetchSyncedMessage, toInboundEmail } from 'src/gtm/sequences/inbound';
import { markReply } from 'src/gtm/sequences/mark-reply';
import { createTwentyStore, type GraphqlClient } from 'src/gtm/sequences/twenty-store';

type ParticipantRecord = { role?: string | null; messageId?: string | null };

// Watches Twenty's email sync: when a message arrives whose sender is a person
// in a sequence, record it as a reply. Fires on the sender participant, which
// is written after the message itself.
const handler = async (event: DatabaseEventPayload) => {
  const after = (event.properties as { after?: ParticipantRecord }).after;
  if (after?.role !== 'from' || !after.messageId) return { ok: true, skipped: 'not a sender' };

  const client = new CoreApiClient() as unknown as GraphqlClient;
  const message = await fetchSyncedMessage(client, after.messageId);
  if (!message) return { ok: true, skipped: 'message not found' };

  const inbound = toInboundEmail(message);
  if (!inbound) return { ok: true, skipped: 'not an inbound reply' };

  return { ok: true, ...(await markReply({ store: createTwentyStore(client), input: inbound })) };
};

export default defineLogicFunction({
  universalIdentifier: DETECT_SEQUENCE_REPLIES_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'detect-sequence-replies',
  description: 'Marks synced inbound emails from enrolled people as sequence replies',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'messageParticipant.created' },
});
