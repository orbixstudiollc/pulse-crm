import { defineField, FieldType } from 'twenty-sdk/define';

import { INBOX_ITEM_DRAFT_REPLY_UNIVERSAL_IDENTIFIER } from 'src/constants/replies-ids';
import { INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';

// AI-drafted answer to a sequence reply (with the booking link when interested).
export default defineField({
  universalIdentifier: INBOX_ITEM_DRAFT_REPLY_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.TEXT,
  name: 'draftReply',
  label: 'Drafted answer',
  icon: 'IconPencil',
  universalSettings: { displayedMaxRows: 8 },
});
