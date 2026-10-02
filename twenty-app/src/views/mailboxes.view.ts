import { defineView, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import * as ids from 'src/constants/mailbox-ids';

// Every sending mailbox with its warmup progress and today's send cap.
export default defineView({
  universalIdentifier: ids.MAILBOXES_VIEW_VIEW_UID,
  name: 'Mailboxes',
  objectUniversalIdentifier: ids.MAILBOX_OBJECT_UID,
  type: ViewType.TABLE,
  icon: 'IconMailbox',
  position: 0,
  fields: [
    { universalIdentifier: ids.MAILBOXES_VIEW_F_EMAIL_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_EMAIL_UID, position: 0, size: 240 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_DISPLAY_NAME_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_DISPLAY_NAME_UID, position: 1, size: 160 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_PROVIDER_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_PROVIDER_UID, position: 2, size: 120 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_STATUS_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_STATUS_UID, position: 3, size: 110 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_WARMUP_ENABLED_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_WARMUP_ENABLED_UID, position: 4, size: 100 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_WARMUP_STAGE_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_WARMUP_STAGE_UID, position: 5, size: 120 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_WARMUP_DAY_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_WARMUP_DAY_UID, position: 6, size: 100 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_CONFIGURED_DAILY_LIMIT_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_CONFIGURED_DAILY_SEND_LIMIT_UID, position: 7, size: 160 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_DAILY_LIMIT_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_DAILY_SEND_LIMIT_UID, position: 8, size: 160 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_DAILY_LIMIT_REASON_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_DAILY_SEND_LIMIT_REASON_UID, position: 9, size: 320 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_SENT_TODAY_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_SENT_TODAY_UID, position: 10, size: 100 },
    { universalIdentifier: ids.MAILBOXES_VIEW_F_HEALTH_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_HEALTH_SCORE_UID, position: 11, size: 90 },
  ],
  sorts: [
    { universalIdentifier: ids.MAILBOXES_VIEW_SORT_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_EMAIL_UID, direction: ViewSortDirection.ASC },
  ],
});
