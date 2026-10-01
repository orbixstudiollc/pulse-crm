// Turns a synced Twenty message into a reply for markReply. Pure helpers plus
// one GraphQL fetch.
//
// Twenty's email sync stores each message with participants (role from / to /
// cc / bcc). A message whose sender is a known person is an inbound email from
// them; our own sends come from a workspace mailbox, not a person, so they are
// ignored.

import type { InboundEmail } from 'src/gtm/sequences/mark-reply';
import type { GraphqlClient } from 'src/gtm/sequences/twenty-store';

export type SyncedParticipant = {
  role?: string | null;
  handle?: string | null;
  personId?: string | null;
  workspaceMemberId?: string | null;
};

export type SyncedMessage = {
  id: string;
  subject?: string | null;
  text?: string | null;
  receivedAt?: string | null;
  participants: SyncedParticipant[];
};

const AUTOMATED_SENDER = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?)([+@.]|$)/i;
const AUTO_REPLY_SUBJECT = /^(auto(matic)?[ -]?reply|out of (the )?office|automatic reply|abwesenheit)/i;

export const isAutomatedSender = (handle: string | null | undefined) =>
  AUTOMATED_SENDER.test((handle ?? '').trim());

export const isAutoReply = (subject: string | null | undefined) =>
  AUTO_REPLY_SUBJECT.test((subject ?? '').trim());

// Out-of-office and bounce notifications must not stop a sequence or mark a
// lead HOT, so they return null.
export const toInboundEmail = (message: SyncedMessage): InboundEmail | null => {
  const from = message.participants.find((p) => p.role === 'from');
  if (!from || from.workspaceMemberId) return null;
  if (isAutomatedSender(from.handle) || isAutoReply(message.subject)) return null;
  if (!from.personId && !from.handle) return null;
  const to = message.participants.find((p) => p.role === 'to');
  return {
    personId: from.personId ?? null,
    fromEmail: from.handle?.trim().toLowerCase() ?? null,
    kind: 'REPLY',
    subject: message.subject ?? null,
    snippet: message.text ?? null,
    receivedAt: message.receivedAt ?? null,
    messageId: message.id,
    mailboxEmail: to?.handle?.trim().toLowerCase() ?? null,
  };
};

export const fetchSyncedMessage = async (
  client: GraphqlClient,
  messageId: string,
): Promise<SyncedMessage | null> => {
  const res = await client.query({
    messages: {
      __args: { filter: { id: { eq: messageId } }, first: 1 },
      edges: {
        node: {
          id: true,
          subject: true,
          text: true,
          receivedAt: true,
          messageParticipants: {
            __args: { first: 50 },
            edges: {
              node: { role: true, handle: true, personId: true, workspaceMemberId: true },
            },
          },
        },
      },
    },
  });
  const node = res?.messages?.edges?.[0]?.node;
  if (!node) return null;
  return {
    id: node.id,
    subject: node.subject,
    text: node.text,
    receivedAt: node.receivedAt,
    participants: (node.messageParticipants?.edges ?? []).map((e: { node: SyncedParticipant }) => e.node),
  };
};
