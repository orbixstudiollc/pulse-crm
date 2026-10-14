import { defineView, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import * as ids from 'src/constants/mailbox-ids';

// Recent warmup emails, newest first.
export default defineView({
  universalIdentifier: ids.WARMUP_LOG_VIEW_VIEW_UID,
  name: 'Warmup log',
  objectUniversalIdentifier: ids.WARMUP_MESSAGE_OBJECT_UID,
  type: ViewType.TABLE,
  icon: 'IconFlame',
  position: 0,
  fields: [
    { universalIdentifier: ids.WARMUP_LOG_VIEW_F_SUBJECT_UID, fieldMetadataUniversalIdentifier: ids.WARMUP_MESSAGE_SUBJECT_UID, position: 0, size: 220 },
    { universalIdentifier: ids.WARMUP_LOG_VIEW_F_FROM_UID, fieldMetadataUniversalIdentifier: ids.WARMUP_MESSAGE_FROM_MAILBOX_UID, position: 1, size: 200 },
    { universalIdentifier: ids.WARMUP_LOG_VIEW_F_TO_UID, fieldMetadataUniversalIdentifier: ids.WARMUP_MESSAGE_TO_MAILBOX_UID, position: 2, size: 200 },
    { universalIdentifier: ids.WARMUP_LOG_VIEW_F_SENT_AT_UID, fieldMetadataUniversalIdentifier: ids.WARMUP_MESSAGE_SENT_AT_UID, position: 3, size: 150 },
    { universalIdentifier: ids.WARMUP_LOG_VIEW_F_SPAM_UID, fieldMetadataUniversalIdentifier: ids.WARMUP_MESSAGE_LANDED_IN_SPAM_UID, position: 4, size: 110 },
    { universalIdentifier: ids.WARMUP_LOG_VIEW_F_RESCUED_UID, fieldMetadataUniversalIdentifier: ids.WARMUP_MESSAGE_RESCUED_UID, position: 5, size: 110 },
    { universalIdentifier: ids.WARMUP_LOG_VIEW_F_REPLIED_UID, fieldMetadataUniversalIdentifier: ids.WARMUP_MESSAGE_REPLIED_UID, position: 6, size: 90 },
    { universalIdentifier: ids.WARMUP_LOG_VIEW_F_BOUNCED_UID, fieldMetadataUniversalIdentifier: ids.WARMUP_MESSAGE_BOUNCED_UID, position: 7, size: 90 },
  ],
  sorts: [
    { universalIdentifier: ids.WARMUP_LOG_VIEW_SORT_UID, fieldMetadataUniversalIdentifier: ids.WARMUP_MESSAGE_SENT_AT_UID, direction: ViewSortDirection.DESC },
  ],
});
