// What a sequence reply means, as sorted by the reply-triage AI. Shared by the
// inboxItem.replyIntent field and the triage logic.

export const REPLY_INTENTS = [
  { label: 'Interested', value: 'INTERESTED', color: 'green' },
  { label: 'Question', value: 'QUESTION', color: 'sky' },
  { label: 'Not now', value: 'NOT_NOW', color: 'yellow' },
  { label: 'Wrong person', value: 'WRONG_PERSON', color: 'purple' },
  { label: 'Not interested', value: 'NOT_INTERESTED', color: 'gray' },
  { label: 'Unsubscribe', value: 'UNSUBSCRIBE', color: 'red' },
  { label: 'Out of office', value: 'OUT_OF_OFFICE', color: 'orange' },
  { label: 'Other', value: 'OTHER', color: 'gray' },
] as const;

export type ReplyIntent = (typeof REPLY_INTENTS)[number]['value'];

export const REPLY_INTENT_VALUES: readonly ReplyIntent[] = REPLY_INTENTS.map((i) => i.value);

// REPLY_AUTO_SEND app variable: whether triage only drafts answers or also
// sends the booking-link answer to interested replies.
export const AUTO_SEND_MODES = ['off', 'interested'] as const;
export type AutoSendMode = (typeof AUTO_SEND_MODES)[number];

export const parseAutoSendMode = (raw: string | undefined): AutoSendMode =>
  raw?.trim().toLowerCase() === 'interested' ? 'interested' : 'off';
