import { defineObject, FieldType } from 'twenty-sdk/define';

import { ICP_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import * as ID from 'src/constants/sequences-ids';
import { manyToOne, oneToMany } from 'src/gtm/sequences/relation-fields';
import { CAMPAIGN_STATUSES, toOptions } from 'src/gtm/sequences/values';

// An outreach push: who (ICP) gets which sequence, with running totals. The
// logic functions keep enrolled / sent / replied up to date; meetings is
// filled in by hand (or a future calendar hook).
export default defineObject({
  universalIdentifier: ID.CAMPAIGN_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'campaign',
  namePlural: 'campaigns',
  labelSingular: 'Campaign',
  labelPlural: 'Campaigns',
  description: 'Outreach to an ICP through a sequence, with results',
  icon: 'IconSpeakerphone',
  labelIdentifierFieldMetadataUniversalIdentifier: ID.CAMPAIGN_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ID.CAMPAIGN_NAME_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconSpeakerphone',
    },
    {
      universalIdentifier: ID.CAMPAIGN_STATUS_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconPlayerPlay',
      options: toOptions(CAMPAIGN_STATUSES),
      defaultValue: "'DRAFT'",
    },
    manyToOne({
      universalIdentifier: ID.CAMPAIGN_ICP_PROFILE_UNIVERSAL_IDENTIFIER,
      name: 'icpProfile',
      label: 'ICP',
      icon: 'IconTarget',
      targetObject: ICP_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.ICP_PROFILE_CAMPAIGNS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: ID.CAMPAIGN_SEQUENCE_UNIVERSAL_IDENTIFIER,
      name: 'sequence',
      label: 'Sequence',
      icon: 'IconRepeat',
      targetObject: ID.SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.SEQUENCE_CAMPAIGNS_UNIVERSAL_IDENTIFIER,
    }),
    {
      universalIdentifier: ID.CAMPAIGN_ENROLLED_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'enrolled',
      label: 'Enrolled',
      icon: 'IconUsers',
      defaultValue: 0,
    },
    {
      universalIdentifier: ID.CAMPAIGN_SENT_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'sent',
      label: 'Sent',
      icon: 'IconSend',
      defaultValue: 0,
    },
    {
      universalIdentifier: ID.CAMPAIGN_REPLIED_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'replied',
      label: 'Replied',
      icon: 'IconMessageReply',
      defaultValue: 0,
    },
    {
      universalIdentifier: ID.CAMPAIGN_MEETINGS_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'meetings',
      label: 'Meetings',
      icon: 'IconCalendarEvent',
      defaultValue: 0,
    },
    oneToMany({
      universalIdentifier: ID.CAMPAIGN_ENROLLMENTS_UNIVERSAL_IDENTIFIER,
      name: 'enrollments',
      label: 'Enrollments',
      icon: 'IconUserCheck',
      targetObject: ID.ENROLLMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.ENROLLMENT_CAMPAIGN_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
