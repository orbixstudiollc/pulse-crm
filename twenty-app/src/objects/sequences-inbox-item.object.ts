import { defineObject, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';
import { manyToOne } from 'src/gtm/sequences/relation-fields';
import { INBOX_ITEM_KINDS, INBOX_ITEM_STATUSES, toOptions } from 'src/gtm/sequences/values';

// One inbound reply (or bounce) to a sequence, for the unified Inbox. Twenty's
// own message objects hold the full email; this is the triage list on top,
// since a plain view over `message` cannot tell sequence replies apart.
export default defineObject({
  universalIdentifier: ID.INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inboxItem',
  namePlural: 'inboxItems',
  labelSingular: 'Inbox item',
  labelPlural: 'Inbox',
  description: 'Replies and bounces from people in sequences',
  icon: 'IconInbox',
  labelIdentifierFieldMetadataUniversalIdentifier: ID.INBOX_ITEM_SUBJECT_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ID.INBOX_ITEM_SUBJECT_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'subject',
      label: 'Subject',
      icon: 'IconMail',
    },
    {
      universalIdentifier: ID.INBOX_ITEM_SNIPPET_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'snippet',
      label: 'Preview',
      icon: 'IconAlignLeft',
      universalSettings: { displayedMaxRows: 4 },
    },
    {
      universalIdentifier: ID.INBOX_ITEM_FROM_EMAIL_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'fromEmail',
      label: 'From',
      icon: 'IconAt',
    },
    {
      universalIdentifier: ID.INBOX_ITEM_RECEIVED_AT_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'receivedAt',
      label: 'Received',
      icon: 'IconClock',
    },
    {
      universalIdentifier: ID.INBOX_ITEM_KIND_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'kind',
      label: 'Kind',
      icon: 'IconMessageReply',
      options: toOptions(INBOX_ITEM_KINDS),
      defaultValue: "'REPLY'",
    },
    {
      universalIdentifier: ID.INBOX_ITEM_STATUS_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconInbox',
      options: toOptions(INBOX_ITEM_STATUSES),
      defaultValue: "'UNREAD'",
    },
    {
      universalIdentifier: ID.INBOX_ITEM_MAILBOX_EMAIL_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'mailboxEmail',
      label: 'Mailbox',
      icon: 'IconMailbox',
    },
    {
      universalIdentifier: ID.INBOX_ITEM_MESSAGE_ID_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'messageId',
      label: 'Message id',
      icon: 'IconHash',
      description: 'Twenty message id (or provider id) of the reply',
    },
    manyToOne({
      universalIdentifier: ID.INBOX_ITEM_PERSON_UNIVERSAL_IDENTIFIER,
      name: 'person',
      label: 'Person',
      icon: 'IconUser',
      targetObject: STANDARD_OBJECT.person.universalIdentifier,
      targetField: ID.PERSON_INBOX_ITEMS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: ID.INBOX_ITEM_ENROLLMENT_UNIVERSAL_IDENTIFIER,
      name: 'enrollment',
      label: 'Enrollment',
      icon: 'IconUserCheck',
      targetObject: ID.ENROLLMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.ENROLLMENT_INBOX_ITEMS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: ID.INBOX_ITEM_SEQUENCE_UNIVERSAL_IDENTIFIER,
      name: 'sequence',
      label: 'Sequence',
      icon: 'IconRepeat',
      targetObject: ID.SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.SEQUENCE_INBOX_ITEMS_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
