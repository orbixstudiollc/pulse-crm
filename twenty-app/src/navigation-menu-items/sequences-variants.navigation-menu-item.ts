import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineNavigationMenuItem({
  universalIdentifier: ID.VARIANTS_NAV_UNIVERSAL_IDENTIFIER,
  name: 'A/B tests',
  icon: 'IconAB',
  position: 15,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: ID.VARIANTS_VIEW_UNIVERSAL_IDENTIFIER,
});
