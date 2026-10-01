import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { COMPANY_PULSE_ID_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Source ids from the old Pulse database, so the import can run more than once
// without creating duplicates.

export default defineField({
  universalIdentifier: COMPANY_PULSE_ID_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'pulseId',
  label: 'Pulse ID',
  icon: 'IconId',
  isUIEditable: false,
});
