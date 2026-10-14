import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineNavigationMenuItem({
  universalIdentifier: ID.TEMPLATES_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Templates',
  icon: 'IconTemplate',
  position: 13,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: ID.TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
});
