import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_LEAD_SOURCE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { LEAD_SOURCES } from 'src/gtm/lead-values';

const person = STANDARD_OBJECT.person.universalIdentifier;

export default defineField({
  universalIdentifier: PERSON_LEAD_SOURCE_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: person,
  type: FieldType.SELECT,
  name: 'leadSource',
  label: 'Lead source',
  icon: 'IconSourceCode',
  options: LEAD_SOURCES.map((s, position) => ({ ...s, position })),
});
