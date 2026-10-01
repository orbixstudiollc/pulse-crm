import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_PULSE_ID_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const person = STANDARD_OBJECT.person.universalIdentifier;

export default defineField({
  universalIdentifier: PERSON_PULSE_ID_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: person,
  type: FieldType.TEXT,
  name: 'pulseId',
  label: 'Pulse ID',
  description: 'Record id in the old Pulse database, used by the import',
  icon: 'IconId',
  isUIEditable: false,
});
