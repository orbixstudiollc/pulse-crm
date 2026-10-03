import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { AGENCY_FOLDER_NAV_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';

// Sidebar folder for client work: approvals, proposals, projects, invoices, services.
export default defineNavigationMenuItem({
  universalIdentifier: AGENCY_FOLDER_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Agency',
  icon: 'IconBriefcase',
  position: 3,
  type: NavigationMenuItemType.FOLDER,
});
