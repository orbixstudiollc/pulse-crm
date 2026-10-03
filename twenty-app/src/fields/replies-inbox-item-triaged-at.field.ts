import { defineField, FieldType } from 'twenty-sdk/define';

import { INBOX_ITEM_TRIAGED_AT_UNIVERSAL_IDENTIFIER } from 'src/constants/replies-ids';
import { INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';

// When triage-reply handled this reply; set items are not triaged again.
export default defineField({
  universalIdentifier: INBOX_ITEM_TRIAGED_AT_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.DATE_TIME,
  name: 'triagedAt',
  label: 'Triaged',
  icon: 'IconRobot',
});
