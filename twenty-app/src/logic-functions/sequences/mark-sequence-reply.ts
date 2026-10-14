import { defineLogicFunction } from 'twenty-sdk/define';

import { MARK_SEQUENCE_REPLY_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';
import { markReply, type InboundEmail } from 'src/gtm/sequences/mark-reply';
import { createTwentyStore } from 'src/gtm/sequences/twenty-store';

// Tool: record a reply (or bounce) from someone in a sequence. Stops their
// active enrollments, sets the lead to HOT (replies only) and adds an Inbox
// item. Also the entry point for any other inbound detector (e.g. a mailbox
// IMAP poller from the mailbox branch).
const handler = async (input: InboundEmail) => {
  try {
    return { ok: true, ...(await markReply({ store: createTwentyStore(), input })) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: MARK_SEQUENCE_REPLY_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'mark-sequence-reply',
  description: 'Record an inbound reply or bounce from a person in a sequence: stops the sequence for them, marks the lead HOT and adds it to the Inbox',
  timeoutSeconds: 30,
  handler,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string', description: 'Person who replied (or give fromEmail)' },
        fromEmail: { type: 'string', description: 'Sender address, used when personId is unknown' },
        kind: { type: 'string', enum: ['REPLY', 'BOUNCE'], description: 'Defaults to REPLY' },
        subject: { type: 'string' },
        snippet: { type: 'string', description: 'Start of the message body' },
        receivedAt: { type: 'string', description: 'ISO date-time; defaults to now' },
        messageId: { type: 'string', description: 'Message id, used to ignore duplicates' },
        mailboxEmail: { type: 'string', description: 'Mailbox that received the reply' },
      },
    },
  },
});
