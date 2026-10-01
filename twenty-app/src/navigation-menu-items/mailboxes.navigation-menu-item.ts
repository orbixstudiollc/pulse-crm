import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { MAILBOX_NAV_FOLDER_UID, MAILBOX_NAV_MAILBOXES_UID, MAILBOXES_VIEW_VIEW_UID } from 'src/constants/mailbox-ids';

export default defineNavigationMenuItem({
  universalIdentifier: MAILBOX_NAV_MAILBOXES_UID,
  name: 'All mailboxes',
  icon: 'IconMailbox',
  position: 0,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: MAILBOXES_VIEW_VIEW_UID,
  folderUniversalIdentifier: MAILBOX_NAV_FOLDER_UID,
});
