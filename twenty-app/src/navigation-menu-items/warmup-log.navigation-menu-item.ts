import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { MAILBOX_NAV_FOLDER_UID, MAILBOX_NAV_WARMUP_LOG_UID, WARMUP_LOG_VIEW_VIEW_UID } from 'src/constants/mailbox-ids';

export default defineNavigationMenuItem({
  universalIdentifier: MAILBOX_NAV_WARMUP_LOG_UID,
  name: 'Warmup log',
  icon: 'IconFlame',
  position: 2,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: WARMUP_LOG_VIEW_VIEW_UID,
  folderUniversalIdentifier: MAILBOX_NAV_FOLDER_UID,
});
