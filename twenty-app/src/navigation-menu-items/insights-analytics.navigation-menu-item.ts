import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { ANALYTICS_NAV_ID, ANALYTICS_PAGE_LAYOUT_ID } from 'src/constants/insights-ids';

export default defineNavigationMenuItem({
  universalIdentifier: ANALYTICS_NAV_ID,
  name: 'Analytics',
  icon: 'IconChartBar',
  position: 10,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: ANALYTICS_PAGE_LAYOUT_ID,
});
