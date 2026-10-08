import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { LEAD_REVIEW_NAV_UNIVERSAL_IDENTIFIER, LEAD_REVIEW_VIEW_UNIVERSAL_IDENTIFIER } from 'src/constants/qualify-ids';

export default defineNavigationMenuItem({
  universalIdentifier: LEAD_REVIEW_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Lead review',
  icon: 'IconUserCheck',
  position: 1,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: LEAD_REVIEW_VIEW_UNIVERSAL_IDENTIFIER,
});
