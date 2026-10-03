import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineNavigationMenuItem({
  universalIdentifier: A.INVOICES_NAV_UNIVERSAL_IDENTIFIER,
  name: 'Invoices',
  icon: 'IconReceipt',
  position: 3,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: A.INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  folderUniversalIdentifier: A.AGENCY_FOLDER_NAV_UNIVERSAL_IDENTIFIER,
});
