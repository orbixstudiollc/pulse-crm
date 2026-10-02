import { defineObject, FieldType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';
import { SEQUENCE_STATUSES, toOptions } from 'src/gtm/sequences/values';

// A multi-step outreach cadence. Only ACTIVE sequences send; enrollments in a
// DRAFT or PAUSED sequence wait.
export default defineObject({
  universalIdentifier: ID.SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'sequence',
  namePlural: 'sequences',
  labelSingular: 'Sequence',
  labelPlural: 'Sequences',
  description: 'Multi-step outreach: emails and tasks spaced by delays',
  icon: 'IconRepeat',
  labelIdentifierFieldMetadataUniversalIdentifier: ID.SEQUENCE_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ID.SEQUENCE_NAME_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconRepeat',
    },
    {
      universalIdentifier: ID.SEQUENCE_DESCRIPTION_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'description',
      label: 'Description',
      icon: 'IconFileDescription',
    },
    {
      universalIdentifier: ID.SEQUENCE_STATUS_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconPlayerPlay',
      options: toOptions(SEQUENCE_STATUSES),
      defaultValue: "'DRAFT'",
    },
    {
      universalIdentifier: ID.SEQUENCE_BUSINESS_DAYS_ONLY_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'businessDaysOnly',
      label: 'Business days only',
      icon: 'IconCalendarWeek',
      description: 'Count delays in weekdays and never send on Saturday or Sunday (UTC)',
      defaultValue: true,
    },
    {
      universalIdentifier: ID.SEQUENCE_REQUIRE_APPROVED_OPENER_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'requireApprovedOpener',
      label: 'Require approved opener',
      icon: 'IconShieldCheck',
      description: 'Hold each email until the enrollment opener is approved',
      defaultValue: false,
    },
    oneToMany({
      universalIdentifier: ID.SEQUENCE_STEPS_UNIVERSAL_IDENTIFIER,
      name: 'steps',
      label: 'Steps',
      icon: 'IconListNumbers',
      targetObject: ID.SEQUENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.SEQUENCE_STEP_SEQUENCE_UNIVERSAL_IDENTIFIER,
    }),
    oneToMany({
      universalIdentifier: ID.SEQUENCE_ENROLLMENTS_UNIVERSAL_IDENTIFIER,
      name: 'enrollments',
      label: 'Enrollments',
      icon: 'IconUserCheck',
      targetObject: ID.ENROLLMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.ENROLLMENT_SEQUENCE_UNIVERSAL_IDENTIFIER,
    }),
    oneToMany({
      universalIdentifier: ID.SEQUENCE_CAMPAIGNS_UNIVERSAL_IDENTIFIER,
      name: 'campaigns',
      label: 'Campaigns',
      icon: 'IconSpeakerphone',
      targetObject: ID.CAMPAIGN_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.CAMPAIGN_SEQUENCE_UNIVERSAL_IDENTIFIER,
    }),
    oneToMany({
      universalIdentifier: ID.SEQUENCE_INBOX_ITEMS_UNIVERSAL_IDENTIFIER,
      name: 'inboxItems',
      label: 'Replies',
      icon: 'IconInbox',
      targetObject: ID.INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.INBOX_ITEM_SEQUENCE_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
