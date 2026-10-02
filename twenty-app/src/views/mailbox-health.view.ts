import { defineView, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import * as ids from 'src/constants/mailbox-ids';

// Warmup health: worst mailboxes first, with spam placement, bounces and errors.
export default defineView({
  universalIdentifier: ids.MAILBOX_HEALTH_VIEW_VIEW_UID,
  name: 'Warmup health',
  objectUniversalIdentifier: ids.MAILBOX_OBJECT_UID,
  type: ViewType.TABLE,
  icon: 'IconHeartbeat',
  position: 1,
  fields: [
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_EMAIL_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_EMAIL_UID, position: 0, size: 240 },
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_STATUS_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_STATUS_UID, position: 1, size: 110 },
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_HEALTH_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_HEALTH_SCORE_UID, position: 2, size: 90 },
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_SPAM_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_SPAM_PLACEMENT_RATE_UID, position: 3, size: 130 },
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_BOUNCE_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_BOUNCE_RATE_UID, position: 4, size: 110 },
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_STAGE_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_WARMUP_STAGE_UID, position: 5, size: 120 },
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_CONFIGURED_LIMIT_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_CONFIGURED_DAILY_SEND_LIMIT_UID, position: 6, size: 160 },
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_LIMIT_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_DAILY_SEND_LIMIT_UID, position: 7, size: 160 },
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_LIMIT_REASON_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_DAILY_SEND_LIMIT_REASON_UID, position: 8, size: 320 },
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_F_LAST_ERROR_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_LAST_ERROR_UID, position: 9, size: 280 },
  ],
  sorts: [
    { universalIdentifier: ids.MAILBOX_HEALTH_VIEW_SORT_UID, fieldMetadataUniversalIdentifier: ids.MAILBOX_HEALTH_SCORE_UID, direction: ViewSortDirection.ASC },
  ],
});
