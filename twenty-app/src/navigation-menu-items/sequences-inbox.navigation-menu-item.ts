import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

// Opens the Inbox object. An OBJECT item, not a VIEW item: the view item
// vanished from one workspace's sidebar (same fix as All mailboxes).
export default defineNavigationMenuItem({
  universalIdentifier: ID.INBOX_NAV_OBJECT_UNIVERSAL_IDENTIFIER,
  name: 'Inbox',
  icon: 'IconInbox',
  position: 10,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: ID.INBOX_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
});
