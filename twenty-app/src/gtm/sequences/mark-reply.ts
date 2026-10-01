// Records an inbound reply (or bounce) from a person in a sequence: stops their
// active enrollments, makes the lead HOT, bumps campaign stats and adds an
// Inbox item. Used by the markSequenceReply tool and the message watcher.

import { transition } from 'src/gtm/sequences/enrollment-state';
import { pickEnrollmentPatch, type SequenceStore } from 'src/gtm/sequences/store';
import type { InboxItemKind } from 'src/gtm/sequences/values';

export type InboundEmail = {
  personId?: string | null;
  fromEmail?: string | null;
  kind?: InboxItemKind;
  subject?: string | null;
  snippet?: string | null;
  receivedAt?: string | null;
  // Twenty message id (or provider id), used to avoid duplicate Inbox items.
  messageId?: string | null;
  // Mailbox that received it, when known.
  mailboxEmail?: string | null;
};

export type MarkReplyResult = {
  personId: string | null;
  matched: boolean;
  stoppedEnrollmentIds: string[];
  leadStatusUpdated: boolean;
  inboxItemId: string | null;
  reason?: string;
};

const SNIPPET_LENGTH = 280;

export const markReply = async ({
  store,
  input,
  now = new Date(),
}: {
  store: SequenceStore;
  input: InboundEmail;
  now?: Date;
}): Promise<MarkReplyResult> => {
  const kind: InboxItemKind = input.kind === 'BOUNCE' ? 'BOUNCE' : 'REPLY';
  const empty = (reason: string, personId: string | null = null): MarkReplyResult => ({
    personId,
    matched: false,
    stoppedEnrollmentIds: [],
    leadStatusUpdated: false,
    inboxItemId: null,
    reason,
  });

  const person = input.personId
    ? ((await store.getPeople([input.personId]))[0] ?? null)
    : input.fromEmail
      ? await store.findPersonByEmail(input.fromEmail.trim().toLowerCase())
      : null;
  if (!person) return empty('No matching person');

  if (input.messageId && (await store.hasInboxItemForMessage(input.messageId))) {
    return empty('Message already recorded', person.id);
  }

  const enrollments = await store.findEnrollments({ personIds: [person.id] });
  if (enrollments.length === 0) return empty('Person is not in any sequence', person.id);

  const at = input.receivedAt ? new Date(input.receivedAt) : now;
  const when = Number.isFinite(at.getTime()) ? at : now;
  const stopped: string[] = [];

  for (const enrollment of enrollments) {
    const next = transition(enrollment, {
      type: kind === 'BOUNCE' ? 'BOUNCED' : 'REPLY_RECEIVED',
      at: when,
    });
    if (next.status === enrollment.status) continue;
    await store.updateEnrollment(enrollment.id, pickEnrollmentPatch(next));
    stopped.push(enrollment.id);
    if (kind === 'REPLY' && enrollment.campaignId) {
      await store.incrementCampaignStats(enrollment.campaignId, { replied: 1 });
    }
  }

  // A reply is a buying signal; never downgrade an existing customer.
  let leadStatusUpdated = false;
  if (kind === 'REPLY' && person.leadStatus !== 'HOT' && person.leadStatus !== 'CUSTOMER') {
    await store.setLeadStatus(person.id, 'HOT');
    leadStatusUpdated = true;
  }

  // Attach the Inbox item to the enrollment it answers: the one just stopped,
  // else the most recently active one.
  const target =
    enrollments.find((e) => e.id === stopped[0]) ??
    [...enrollments].sort((a, b) => (b.lastSentAt ?? '').localeCompare(a.lastSentAt ?? ''))[0];

  const snippet = (input.snippet ?? '').replace(/\s+/g, ' ').trim();
  const inboxItemId = await store.createInboxItem({
    subject: input.subject?.trim() || (kind === 'BOUNCE' ? 'Bounced email' : '(no subject)'),
    snippet: snippet ? snippet.slice(0, SNIPPET_LENGTH) : null,
    fromEmail: input.fromEmail ?? person.emails?.primaryEmail ?? null,
    receivedAt: when.toISOString(),
    kind,
    mailboxEmail: input.mailboxEmail ?? target?.mailboxEmail ?? null,
    messageId: input.messageId ?? null,
    personId: person.id,
    enrollmentId: target?.id ?? null,
    sequenceId: target?.sequenceId ?? null,
  });

  return {
    personId: person.id,
    matched: true,
    stoppedEnrollmentIds: stopped,
    leadStatusUpdated,
    inboxItemId,
  };
};
