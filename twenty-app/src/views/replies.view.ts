import {
  defineView,
  ViewFilterOperand,
  ViewSortDirection,
  ViewType,
} from 'twenty-sdk/define';

import * as R from 'src/constants/replies-ids';
import * as ID from 'src/constants/sequences-ids';

// Sequence replies with the AI's intent, summary and drafted answer, newest
// first. Opens from the Inbox's view picker.
export default defineView({
  universalIdentifier: R.REPLIES_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Replies',
  objectUniversalIdentifier: ID.INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconMessageReply',
  position: 1,
  fields: [
    { universalIdentifier: R.REPLIES_VIEW_F_SUBJECT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_SUBJECT_UNIVERSAL_IDENTIFIER, position: 0, size: 220 },
    { universalIdentifier: R.REPLIES_VIEW_F_PERSON_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_PERSON_UNIVERSAL_IDENTIFIER, position: 1, size: 170 },
    { universalIdentifier: R.REPLIES_VIEW_F_INTENT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: R.INBOX_ITEM_REPLY_INTENT_UNIVERSAL_IDENTIFIER, position: 2, size: 130 },
    { universalIdentifier: R.REPLIES_VIEW_F_SUMMARY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: R.INBOX_ITEM_AI_SUMMARY_UNIVERSAL_IDENTIFIER, position: 3, size: 280 },
    { universalIdentifier: R.REPLIES_VIEW_F_DRAFT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: R.INBOX_ITEM_DRAFT_REPLY_UNIVERSAL_IDENTIFIER, position: 4, size: 320 },
    { universalIdentifier: R.REPLIES_VIEW_F_AUTO_SENT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: R.INBOX_ITEM_AUTO_SENT_AT_UNIVERSAL_IDENTIFIER, position: 5, size: 140 },
    { universalIdentifier: R.REPLIES_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_STATUS_UNIVERSAL_IDENTIFIER, position: 6, size: 100 },
    { universalIdentifier: R.REPLIES_VIEW_F_RECEIVED_AT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_RECEIVED_AT_UNIVERSAL_IDENTIFIER, position: 7, size: 150 },
  ],
  filters: [
    {
      universalIdentifier: R.REPLIES_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_KIND_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      value: ['REPLY'],
    },
  ],
  sorts: [
    {
      universalIdentifier: R.REPLIES_VIEW_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: ID.INBOX_ITEM_RECEIVED_AT_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.DESC,
    },
  ],
});
