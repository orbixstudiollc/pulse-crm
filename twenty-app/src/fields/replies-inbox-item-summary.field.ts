import { defineField, FieldType } from 'twenty-sdk/define';

import { INBOX_ITEM_AI_SUMMARY_UNIVERSAL_IDENTIFIER } from 'src/constants/replies-ids';
import { INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';

// One-line AI summary of a sequence reply.
export default defineField({
  universalIdentifier: INBOX_ITEM_AI_SUMMARY_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.TEXT,
  name: 'aiSummary',
  label: 'AI summary',
  icon: 'IconSparkles',
});
