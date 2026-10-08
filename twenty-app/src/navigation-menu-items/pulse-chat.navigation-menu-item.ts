import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { PULSE_CHAT_NAV_UNIVERSAL_IDENTIFIER, PULSE_CHAT_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER } from 'src/constants/chat-ids';

export default defineNavigationMenuItem({
  universalIdentifier: PULSE_CHAT_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Pulse chat',
  icon: 'IconMessageCircle',
  position: 0,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: PULSE_CHAT_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
