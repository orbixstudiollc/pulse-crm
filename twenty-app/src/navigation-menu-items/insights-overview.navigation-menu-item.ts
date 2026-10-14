import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { OVERVIEW_NAV_ID, OVERVIEW_PAGE_LAYOUT_ID } from 'src/constants/insights-ids';

export default defineNavigationMenuItem({
  universalIdentifier: OVERVIEW_NAV_ID,
  name: 'Overview',
  icon: 'IconHome',
  position: -1,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: OVERVIEW_PAGE_LAYOUT_ID,
});
