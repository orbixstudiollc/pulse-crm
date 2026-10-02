import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { WEBSITE_VISIT_OBJECT_ID, WEBSITE_VISITS_NAV_OBJECT_ID } from 'src/constants/insights-ids';

// Opens the Website visits object. An OBJECT item, not a VIEW item: the view
// item vanished from the sidebar (same fix as Inbox and All mailboxes).
export default defineNavigationMenuItem({
  universalIdentifier: WEBSITE_VISITS_NAV_OBJECT_ID,
  name: 'Website Visitors',
  icon: 'IconWorldWww',
  position: 11,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: WEBSITE_VISIT_OBJECT_ID,
});
