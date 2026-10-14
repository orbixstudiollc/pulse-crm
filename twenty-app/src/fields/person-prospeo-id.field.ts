import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_PROSPEO_ID_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const person = STANDARD_OBJECT.person.universalIdentifier;

export default defineField({
  universalIdentifier: PERSON_PROSPEO_ID_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: person,
  type: FieldType.TEXT,
  name: 'prospeoPersonId',
  label: 'Prospeo ID',
  icon: 'IconId',
  isUIEditable: false,
});
