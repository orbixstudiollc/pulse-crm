import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { MAILBOX_NAV_FOLDER_UID, MAILBOX_NAV_MAILBOXES_OBJECT_UID, MAILBOX_OBJECT_UID } from 'src/constants/mailbox-ids';

// Opens the Mailboxes object (pick the "Mailboxes" view from the view menu).
// An OBJECT item, not a VIEW item: a view item vanished from one workspace's sidebar.
export default defineNavigationMenuItem({
  universalIdentifier: MAILBOX_NAV_MAILBOXES_OBJECT_UID,
  name: 'All mailboxes',
  icon: 'IconMailbox',
  position: 0,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: MAILBOX_OBJECT_UID,
  folderUniversalIdentifier: MAILBOX_NAV_FOLDER_UID,
});
