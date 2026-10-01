import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  ICP_NAV_UNIVERSAL_IDENTIFIER,
  ICP_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: ICP_NAV_UNIVERSAL_IDENTIFIER,
  name: 'ICPs',
  icon: 'IconTarget',
  position: 1,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: ICP_VIEW_UNIVERSAL_IDENTIFIER,
});
