import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineNavigationMenuItem({
  universalIdentifier: ID.CAMPAIGNS_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Campaigns',
  icon: 'IconSpeakerphone',
  position: 12,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: ID.CAMPAIGNS_VIEW_UNIVERSAL_IDENTIFIER,
});
