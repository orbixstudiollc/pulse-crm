import { defineField, FieldType } from 'twenty-sdk/define';

import { INBOX_ITEM_AUTO_SENT_AT_UNIVERSAL_IDENTIFIER } from 'src/constants/replies-ids';
import { INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';

// When the drafted answer was sent automatically (REPLY_AUTO_SEND).
export default defineField({
  universalIdentifier: INBOX_ITEM_AUTO_SENT_AT_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.DATE_TIME,
  name: 'autoSentAt',
  label: 'Answer sent',
  icon: 'IconSend',
});
