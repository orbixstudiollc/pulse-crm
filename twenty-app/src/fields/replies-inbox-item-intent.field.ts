import { defineField, FieldType } from 'twenty-sdk/define';

import { INBOX_ITEM_REPLY_INTENT_UNIVERSAL_IDENTIFIER } from 'src/constants/replies-ids';
import { INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';
import { REPLY_INTENTS } from 'src/gtm/replies/values';
import { toOptions } from 'src/gtm/sequences/values';

// What a sequence reply means, set by triage-reply.
export default defineField({
  universalIdentifier: INBOX_ITEM_REPLY_INTENT_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.SELECT,
  name: 'replyIntent',
  label: 'Intent',
  icon: 'IconTarget',
  options: toOptions(REPLY_INTENTS),
});
