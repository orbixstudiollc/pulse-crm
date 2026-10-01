import {
  defineView,
  ViewFilterOperand,
  ViewSortDirection,
  ViewType,
} from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

// Unified Inbox: replies and bounces from every sequence, newest first,
// archived items hidden.
export default defineView({
  universalIdentifier: ID.INBOX_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Inbox',
  objectUniversalIdentifier: ID.INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconInbox',
  position: 0,
  fields: [
    { universalIdentifier: ID.INBOX_VIEW_F_SUBJECT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_SUBJECT_UNIVERSAL_IDENTIFIER, position: 0, size: 240 },
    { universalIdentifier: ID.INBOX_VIEW_F_PERSON_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_PERSON_UNIVERSAL_IDENTIFIER, position: 1, size: 170 },
    { universalIdentifier: ID.INBOX_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_STATUS_UNIVERSAL_IDENTIFIER, position: 2, size: 100 },
    { universalIdentifier: ID.INBOX_VIEW_F_KIND_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_KIND_UNIVERSAL_IDENTIFIER, position: 3, size: 90 },
    { universalIdentifier: ID.INBOX_VIEW_F_SNIPPET_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_SNIPPET_UNIVERSAL_IDENTIFIER, position: 4, size: 320 },
    { universalIdentifier: ID.INBOX_VIEW_F_SEQUENCE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_SEQUENCE_UNIVERSAL_IDENTIFIER, position: 5, size: 170 },
    { universalIdentifier: ID.INBOX_VIEW_F_RECEIVED_AT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_RECEIVED_AT_UNIVERSAL_IDENTIFIER, position: 6, size: 150 },
    { universalIdentifier: ID.INBOX_VIEW_F_FROM_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_FROM_EMAIL_UNIVERSAL_IDENTIFIER, position: 7, size: 200 },
    { universalIdentifier: ID.INBOX_VIEW_F_MAILBOX_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_MAILBOX_EMAIL_UNIVERSAL_IDENTIFIER, position: 8, size: 200 },
  ],
  filters: [
    {
      universalIdentifier: ID.INBOX_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_STATUS_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      value: ['UNREAD', 'READ'],
    },
  ],
  sorts: [
    {
      universalIdentifier: ID.INBOX_VIEW_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_RECEIVED_AT_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.DESC,
    },
  ],
});
