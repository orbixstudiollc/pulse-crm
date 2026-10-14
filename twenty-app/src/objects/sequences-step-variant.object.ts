import { defineObject, FieldType, OnDeleteAction } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';
import { manyToOne } from 'src/gtm/sequences/relation-fields';

// An A/B variant of an email step. Enrollments are split across a step's
// active variants by weight (deterministically per enrollment); empty subject
// or body fall back to the step's template. Stats are kept by the sender and
// reply detection; rates are percentages.
const counter = (universalIdentifier: string, name: string, label: string, icon: string) => ({
  universalIdentifier,
  type: FieldType.NUMBER as const,
  name,
  label,
  icon,
  defaultValue: 0,
});

export default defineObject({
  universalIdentifier: ID.VARIANT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'sequenceStepVariant',
  namePlural: 'sequenceStepVariants',
  labelSingular: 'Step variant',
  labelPlural: 'Step variants',
  description: 'A/B variants of a sequence email, with sent / opened / replied stats',
  icon: 'IconAB',
  labelIdentifierFieldMetadataUniversalIdentifier: ID.VARIANT_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ID.VARIANT_NAME_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAB',
    },
    {
      universalIdentifier: ID.VARIANT_SUBJECT_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'subject',
      label: 'Subject',
      icon: 'IconMail',
    },
    {
      universalIdentifier: ID.VARIANT_BODY_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'body',
      label: 'Body',
      icon: 'IconAlignLeft',
      universalSettings: { displayedMaxRows: 12 },
    },
    {
      universalIdentifier: ID.VARIANT_WEIGHT_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'weight',
      label: 'Weight',
      icon: 'IconScale',
      description: 'Relative share of sends (e.g. 50 / 50)',
      defaultValue: 50,
    },
    {
      universalIdentifier: ID.VARIANT_IS_ACTIVE_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Active',
      icon: 'IconCircleCheck',
      defaultValue: true,
    },
    {
      universalIdentifier: ID.VARIANT_IS_WINNER_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isWinner',
      label: 'Winner',
      icon: 'IconTrophy',
      defaultValue: false,
    },
    counter(ID.VARIANT_SENT_UNIVERSAL_IDENTIFIER, 'sent', 'Sent', 'IconSend'),
    counter(ID.VARIANT_OPENED_UNIVERSAL_IDENTIFIER, 'opened', 'Opened', 'IconMailOpened'),
    counter(ID.VARIANT_REPLIED_UNIVERSAL_IDENTIFIER, 'replied', 'Replied', 'IconMessageReply'),
    counter(ID.VARIANT_REPLY_RATE_UNIVERSAL_IDENTIFIER, 'replyRate', 'Reply rate %', 'IconPercentage'),
    counter(ID.VARIANT_OPEN_RATE_UNIVERSAL_IDENTIFIER, 'openRate', 'Open rate %', 'IconPercentage'),
    manyToOne({
      universalIdentifier: ID.VARIANT_STEP_UNIVERSAL_IDENTIFIER,
      name: 'step',
      label: 'Step',
      icon: 'IconListNumbers',
      targetObject: ID.SEQUENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.SEQUENCE_STEP_VARIANTS_UNIVERSAL_IDENTIFIER,
      onDelete: OnDeleteAction.CASCADE,
    }),
  ],
});
