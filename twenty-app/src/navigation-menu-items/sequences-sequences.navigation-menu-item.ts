import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineNavigationMenuItem({
  universalIdentifier: ID.SEQUENCES_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Sequences',
  icon: 'IconRepeat',
  position: 11,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: ID.SEQUENCES_VIEW_UNIVERSAL_IDENTIFIER,
});
