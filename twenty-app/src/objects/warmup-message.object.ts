import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

import {
  MAILBOX_OBJECT_UID,
  MAILBOX_RECEIVED_WARMUP_MESSAGES_UID,
  MAILBOX_SENT_WARMUP_MESSAGES_UID,
  WARMUP_MESSAGE_BOUNCED_UID,
  WARMUP_MESSAGE_FROM_MAILBOX_UID,
  WARMUP_MESSAGE_LANDED_IN_SPAM_UID,
  WARMUP_MESSAGE_MESSAGE_ID_UID,
  WARMUP_MESSAGE_OBJECT_UID,
  WARMUP_MESSAGE_PROCESSED_AT_UID,
  WARMUP_MESSAGE_REPLIED_UID,
  WARMUP_MESSAGE_RESCUED_UID,
  WARMUP_MESSAGE_SENT_AT_UID,
  WARMUP_MESSAGE_SUBJECT_UID,
  WARMUP_MESSAGE_TAG_UID,
  WARMUP_MESSAGE_TO_MAILBOX_UID,
} from 'src/constants/mailbox-ids';

// Log of every warmup email: who sent it to whom, where it landed and what
// the receiving inbox did with it. Health stats are computed from this log.
export default defineObject({
  universalIdentifier: WARMUP_MESSAGE_OBJECT_UID,
  nameSingular: 'warmupMessage',
  namePlural: 'warmupMessages',
  labelSingular: 'Warmup email',
  labelPlural: 'Warmup emails',
  description: 'Log of warmup emails between your own mailboxes',
  icon: 'IconFlame',
  labelIdentifierFieldMetadataUniversalIdentifier: WARMUP_MESSAGE_SUBJECT_UID,
  fields: [
    { universalIdentifier: WARMUP_MESSAGE_SUBJECT_UID, type: FieldType.TEXT, name: 'subject', label: 'Subject', icon: 'IconMail' },
    {
      universalIdentifier: WARMUP_MESSAGE_FROM_MAILBOX_UID,
      type: FieldType.RELATION,
      name: 'fromMailbox',
      label: 'From',
      icon: 'IconSend',
      relationTargetObjectMetadataUniversalIdentifier: MAILBOX_OBJECT_UID,
      relationTargetFieldMetadataUniversalIdentifier: MAILBOX_SENT_WARMUP_MESSAGES_UID,
      universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.CASCADE, joinColumnName: 'fromMailboxId' },
    },
    {
      universalIdentifier: WARMUP_MESSAGE_TO_MAILBOX_UID,
      type: FieldType.RELATION,
      name: 'toMailbox',
      label: 'To',
      icon: 'IconInbox',
      relationTargetObjectMetadataUniversalIdentifier: MAILBOX_OBJECT_UID,
      relationTargetFieldMetadataUniversalIdentifier: MAILBOX_RECEIVED_WARMUP_MESSAGES_UID,
      universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.CASCADE, joinColumnName: 'toMailboxId' },
    },
    { universalIdentifier: WARMUP_MESSAGE_SENT_AT_UID, type: FieldType.DATE_TIME, name: 'sentAt', label: 'Sent', icon: 'IconClock' },
    { universalIdentifier: WARMUP_MESSAGE_MESSAGE_ID_UID, type: FieldType.TEXT, name: 'messageId', label: 'Message-ID', icon: 'IconHash' },
    { universalIdentifier: WARMUP_MESSAGE_TAG_UID, type: FieldType.TEXT, name: 'tag', label: 'Warmup tag', icon: 'IconTag', isUnique: true },
    { universalIdentifier: WARMUP_MESSAGE_LANDED_IN_SPAM_UID, type: FieldType.BOOLEAN, name: 'landedInSpam', label: 'Landed in spam', icon: 'IconAlertTriangle' },
    { universalIdentifier: WARMUP_MESSAGE_RESCUED_UID, type: FieldType.BOOLEAN, name: 'rescued', label: 'Moved out of spam', icon: 'IconLifebuoy' },
    { universalIdentifier: WARMUP_MESSAGE_REPLIED_UID, type: FieldType.BOOLEAN, name: 'replied', label: 'Replied', icon: 'IconArrowBackUp' },
    { universalIdentifier: WARMUP_MESSAGE_BOUNCED_UID, type: FieldType.BOOLEAN, name: 'bounced', label: 'Bounced', icon: 'IconMailOff', defaultValue: false },
    { universalIdentifier: WARMUP_MESSAGE_PROCESSED_AT_UID, type: FieldType.DATE_TIME, name: 'processedAt', label: 'Seen by inbox', icon: 'IconEye' },
  ],
});
