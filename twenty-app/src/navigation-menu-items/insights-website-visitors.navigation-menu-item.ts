import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { WEBSITE_VISITS_NAV_ID, WEBSITE_VISITS_VIEW_ID } from 'src/constants/insights-ids';

export default defineNavigationMenuItem({
  universalIdentifier: WEBSITE_VISITS_NAV_ID,
  name: 'Website Visitors',
  icon: 'IconWorldWww',
  position: 11,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: WEBSITE_VISITS_VIEW_ID,
});
