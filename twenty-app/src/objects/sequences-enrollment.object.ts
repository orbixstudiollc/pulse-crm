import { defineObject, FieldType, OnDeleteAction, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';
import { manyToOne, oneToMany } from 'src/gtm/sequences/relation-fields';
import { ENROLLMENT_STATUSES, toOptions } from 'src/gtm/sequences/values';

// A person going through a sequence. The sendSequenceSteps cron picks up
// ACTIVE enrollments whose next send is due; a reply or bounce ends them.
export default defineObject({
  universalIdentifier: ID.ENROLLMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'sequenceEnrollment',
  namePlural: 'sequenceEnrollments',
  labelSingular: 'Enrollment',
  labelPlural: 'Enrollments',
  description: 'A person in a sequence: current step, next send, outcome',
  icon: 'IconUserCheck',
  labelIdentifierFieldMetadataUniversalIdentifier: ID.ENROLLMENT_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ID.ENROLLMENT_NAME_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconUserCheck',
    },
    manyToOne({
      universalIdentifier: ID.ENROLLMENT_PERSON_UNIVERSAL_IDENTIFIER,
      name: 'person',
      label: 'Person',
      icon: 'IconUser',
      targetObject: STANDARD_OBJECT.person.universalIdentifier,
      targetField: ID.PERSON_SEQUENCE_ENROLLMENTS_UNIVERSAL_IDENTIFIER,
      onDelete: OnDeleteAction.CASCADE,
    }),
    manyToOne({
      universalIdentifier: ID.ENROLLMENT_SEQUENCE_UNIVERSAL_IDENTIFIER,
      name: 'sequence',
      label: 'Sequence',
      icon: 'IconRepeat',
      targetObject: ID.SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.SEQUENCE_ENROLLMENTS_UNIVERSAL_IDENTIFIER,
      onDelete: OnDeleteAction.CASCADE,
    }),
    manyToOne({
      universalIdentifier: ID.ENROLLMENT_CAMPAIGN_UNIVERSAL_IDENTIFIER,
      name: 'campaign',
      label: 'Campaign',
      icon: 'IconSpeakerphone',
      targetObject: ID.CAMPAIGN_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.CAMPAIGN_ENROLLMENTS_UNIVERSAL_IDENTIFIER,
    }),
    {
      universalIdentifier: ID.ENROLLMENT_CURRENT_STEP_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'currentStep',
      label: 'Current step',
      icon: 'IconListNumbers',
      description: 'Position (1-based, in step order) of the next step to run',
      defaultValue: 1,
    },
    {
      universalIdentifier: ID.ENROLLMENT_STATUS_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconProgress',
      options: toOptions(ENROLLMENT_STATUSES),
      defaultValue: "'ACTIVE'",
    },
    {
      universalIdentifier: ID.ENROLLMENT_NEXT_SEND_AT_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'nextSendAt',
      label: 'Next send',
      icon: 'IconClock',
    },
    {
      universalIdentifier: ID.ENROLLMENT_LAST_SENT_AT_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'lastSentAt',
      label: 'Last sent',
      icon: 'IconSend',
    },
    {
      universalIdentifier: ID.ENROLLMENT_REPLIED_AT_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'repliedAt',
      label: 'Replied',
      icon: 'IconMessageReply',
    },
    {
      universalIdentifier: ID.ENROLLMENT_MAILBOX_EMAIL_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'mailboxEmail',
      label: 'Mailbox',
      icon: 'IconMailbox',
      description: 'Mailbox that sends this enrollment (kept for every follow-up)',
    },
    {
      universalIdentifier: ID.ENROLLMENT_STOP_REASON_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'stopReason',
      label: 'Stop reason',
      icon: 'IconHandStop',
    },
    {
      universalIdentifier: ID.ENROLLMENT_LAST_ERROR_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'lastError',
      label: 'Last error',
      icon: 'IconAlertTriangle',
    },
    oneToMany({
      universalIdentifier: ID.ENROLLMENT_INBOX_ITEMS_UNIVERSAL_IDENTIFIER,
      name: 'inboxItems',
      label: 'Replies',
      icon: 'IconInbox',
      targetObject: ID.INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.INBOX_ITEM_ENROLLMENT_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
