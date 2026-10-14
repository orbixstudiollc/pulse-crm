import { defineCommandMenuItem, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  ENRICH_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  ENRICH_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/leadfinder-ids';

export default defineCommandMenuItem({
  universalIdentifier: ENRICH_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Enrich with Prospeo',
  shortLabel: 'Enrich',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  frontComponentUniversalIdentifier: ENRICH_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
