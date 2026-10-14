import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  LEADS_NAV_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: LEADS_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Leads',
  icon: 'IconFlame',
  position: 0,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: LEADS_VIEW_UNIVERSAL_IDENTIFIER,
});
