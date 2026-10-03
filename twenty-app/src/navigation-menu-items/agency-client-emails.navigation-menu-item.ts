import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineNavigationMenuItem({
  universalIdentifier: A.CLIENT_EMAILS_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Client emails',
  icon: 'IconMailForward',
  position: 0,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: A.CLIENT_EMAIL_OBJECT_UNIVERSAL_IDENTIFIER,
  folderUniversalIdentifier: A.AGENCY_FOLDER_NAV_UNIVERSAL_IDENTIFIER,
});
