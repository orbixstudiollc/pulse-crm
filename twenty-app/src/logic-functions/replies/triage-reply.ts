import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';
import { kv, runAgent } from 'twenty-sdk/logic-function';

import {
  REPLY_TRIAGE_AGENT_UNIVERSAL_IDENTIFIER,
  TRIAGE_REPLY_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/replies-ids';
import { bookingLinkFrom } from 'src/gtm/replies/app-variables';
import { TRIAGE_INSTRUCTIONS, TRIAGE_MAX_TOKENS } from 'src/gtm/replies/classify';
import { triageReply } from 'src/gtm/replies/triage';
import { createReplyStore } from 'src/gtm/replies/twenty-store';
import { parseAutoSendMode } from 'src/gtm/replies/values';
import { PICKED_AI_MODEL_KV_KEY, withPickedModel } from 'src/gtm/sequences/ai-models';
import { createOutreachMailer } from 'src/gtm/sequences/create-mail-transport';
import { pickOpenerWriter } from 'src/gtm/sequences/opener-writers';
import type { OutreachMailer } from 'src/gtm/sequences/transport';

type ToolInput = { inboxItemId?: string; force?: boolean };
type InboxItemEvent = { id?: string; kind?: string | null };

// Runs on every new Inbox item (only sequence replies are acted on), and as a
// tool to re-run triage on one item.
const handler = async (input: DatabaseEventPayload | ToolInput) => {
  const tool = input as ToolInput;
  const after = ((input as DatabaseEventPayload).properties as { after?: InboxItemEvent } | undefined)?.after;
  const inboxItemId = tool.inboxItemId ?? after?.id;
  if (!inboxItemId) return { ok: true, skipped: 'No inbox item id' };
  if (after && after.kind && after.kind !== 'REPLY') return { ok: true, skipped: 'Not a sequence reply' };

  let mailer: OutreachMailer | null = null;
  try {
    const env = withPickedModel(process.env, await kv.get<string>(PICKED_AI_MODEL_KV_KEY));
    const writer = pickOpenerWriter(env, runAgent, REPLY_TRIAGE_AGENT_UNIVERSAL_IDENTIFIER, undefined, {
      system: TRIAGE_INSTRUCTIONS,
      maxTokens: TRIAGE_MAX_TOKENS,
    });
    const store = createReplyStore();
    const item = await store.getInboxItem(inboxItemId);
    // The mailer gives the sender name for the sign-off and sends when auto-send is on.
    mailer = await createOutreachMailer().catch(() => null);
    return await triageReply({
      store,
      writer,
      inboxItemId,
      settings: {
        bookingLink: bookingLinkFrom(process.env.BOOKING_LINK),
        autoSend: parseAutoSendMode(process.env.REPLY_AUTO_SEND),
      },
      mailer,
      senderName: item?.mailboxEmail ? (mailer?.senderNameFor?.(item.mailboxEmail) ?? null) : null,
      force: Boolean(tool.force),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await mailer?.close?.().catch(() => undefined);
  }
};

export default defineLogicFunction({
  universalIdentifier: TRIAGE_REPLY_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'triage-reply',
  description:
    'Sorts a sequence reply (interested, question, not now, wrong person, not interested, unsubscribe, out of office), drafts the answer with the booking link and does the follow-up: deal, task, lead status or resuming the sequence.',
  timeoutSeconds: 120,
  handler,
  databaseEventTriggerSettings: { eventName: 'inboxItem.created' },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        inboxItemId: { type: 'string', description: 'Inbox item (a sequence reply) to triage' },
        force: { type: 'boolean', description: 'Triage again even if it was already triaged' },
      },
      required: ['inboxItemId'],
    },
  },
});
