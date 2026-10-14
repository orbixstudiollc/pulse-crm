import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineNavigationMenuItem({
  universalIdentifier: ID.OPENERS_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Openers to review',
  icon: 'IconSparkles',
  position: 16,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: ID.OPENERS_VIEW_UNIVERSAL_IDENTIFIER,
});
