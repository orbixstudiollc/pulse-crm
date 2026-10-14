import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { PULSE_SETUP_NAV_UNIVERSAL_IDENTIFIER, PULSE_SETUP_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';

export default defineNavigationMenuItem({
  universalIdentifier: PULSE_SETUP_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Setup',
  icon: 'IconSettings',
  position: 99,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: PULSE_SETUP_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
