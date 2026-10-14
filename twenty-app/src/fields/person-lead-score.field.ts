import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_LEAD_SCORE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const person = STANDARD_OBJECT.person.universalIdentifier;

export default defineField({
  universalIdentifier: PERSON_LEAD_SCORE_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: person,
  type: FieldType.NUMBER,
  name: 'leadScore',
  label: 'Lead score',
  description: 'AI fit score from 0 to 100',
  icon: 'IconGauge',
});
