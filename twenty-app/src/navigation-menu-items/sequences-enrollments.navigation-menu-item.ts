import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineNavigationMenuItem({
  universalIdentifier: ID.ENROLLMENTS_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Enrollments',
  icon: 'IconUserCheck',
  position: 14,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: ID.ENROLLMENTS_VIEW_UNIVERSAL_IDENTIFIER,
});
