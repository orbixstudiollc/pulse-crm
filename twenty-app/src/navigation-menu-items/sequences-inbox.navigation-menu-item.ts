import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineNavigationMenuItem({
  universalIdentifier: ID.INBOX_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Inbox',
  icon: 'IconInbox',
  position: 10,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: ID.INBOX_VIEW_UNIVERSAL_IDENTIFIER,
});
