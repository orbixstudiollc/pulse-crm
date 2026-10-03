import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineNavigationMenuItem({
  universalIdentifier: A.SERVICES_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Services',
  icon: 'IconBriefcase',
  position: 4,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: A.SERVICE_OBJECT_UNIVERSAL_IDENTIFIER,
  folderUniversalIdentifier: A.AGENCY_FOLDER_NAV_UNIVERSAL_IDENTIFIER,
});
