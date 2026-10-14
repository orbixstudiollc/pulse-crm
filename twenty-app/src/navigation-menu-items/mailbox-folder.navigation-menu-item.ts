import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { MAILBOX_NAV_FOLDER_UID } from 'src/constants/mailbox-ids';

// Sidebar folder holding the mailbox and warmup views.
export default defineNavigationMenuItem({
  universalIdentifier: MAILBOX_NAV_FOLDER_UID,
  name: 'Mailboxes',
  icon: 'IconMailbox',
  position: 2,
  type: NavigationMenuItemType.FOLDER,
});
