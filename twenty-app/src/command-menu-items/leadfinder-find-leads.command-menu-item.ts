import { defineCommandMenuItem } from 'twenty-sdk/define';

import { ICP_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  FIND_LEADS_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  FIND_LEADS_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/leadfinder-ids';

export default defineCommandMenuItem({
  universalIdentifier: FIND_LEADS_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Find leads',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: ICP_OBJECT_UNIVERSAL_IDENTIFIER,
  // Searches with the first selected ICP.
  frontComponentUniversalIdentifier: FIND_LEADS_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
