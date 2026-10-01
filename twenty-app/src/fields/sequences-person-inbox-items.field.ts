import { defineField, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// Person side of inboxItem.person: replies this person sent to sequences.
export default defineField({
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  ...oneToMany({
    universalIdentifier: ID.PERSON_INBOX_ITEMS_UNIVERSAL_IDENTIFIER,
    name: 'inboxItems',
    label: 'Sequence replies',
    icon: 'IconInbox',
    targetObject: ID.INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
    targetField: ID.INBOX_ITEM_PERSON_UNIVERSAL_IDENTIFIER,
  }),
});
