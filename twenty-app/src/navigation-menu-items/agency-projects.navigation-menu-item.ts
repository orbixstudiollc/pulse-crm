import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineNavigationMenuItem({
  universalIdentifier: A.PROJECTS_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Projects',
  icon: 'IconFolder',
  position: 2,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: A.PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  folderUniversalIdentifier: A.AGENCY_FOLDER_NAV_UNIVERSAL_IDENTIFIER,
});
