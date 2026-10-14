import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { OPPORTUNITY_PULSE_ID_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: OPPORTUNITY_PULSE_ID_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.opportunity.universalIdentifier,
  type: FieldType.TEXT,
  name: 'pulseId',
  label: 'Pulse ID',
  icon: 'IconId',
  isUIEditable: false,
});
