import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { MAILBOX_HEALTH_VIEW_VIEW_UID, MAILBOX_NAV_FOLDER_UID, MAILBOX_NAV_HEALTH_UID } from 'src/constants/mailbox-ids';

export default defineNavigationMenuItem({
  universalIdentifier: MAILBOX_NAV_HEALTH_UID,
  name: 'Warmup health',
  icon: 'IconHeartbeat',
  position: 1,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: MAILBOX_HEALTH_VIEW_VIEW_UID,
  folderUniversalIdentifier: MAILBOX_NAV_FOLDER_UID,
});
