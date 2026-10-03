import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineNavigationMenuItem({
  universalIdentifier: A.PROPOSALS_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Proposals',
  icon: 'IconFileText',
  position: 1,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: A.PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  folderUniversalIdentifier: A.AGENCY_FOLDER_NAV_UNIVERSAL_IDENTIFIER,
});
