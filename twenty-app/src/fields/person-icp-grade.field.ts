import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_ICP_GRADE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const person = STANDARD_OBJECT.person.universalIdentifier;

export default defineField({
  universalIdentifier: PERSON_ICP_GRADE_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: person,
  type: FieldType.SELECT,
  name: 'icpGrade',
  label: 'ICP grade',
  icon: 'IconTarget',
  options: [
    { label: 'A', value: 'A', color: 'green', position: 0 },
    { label: 'B', value: 'B', color: 'blue', position: 1 },
    { label: 'C', value: 'C', color: 'yellow', position: 2 },
    { label: 'D', value: 'D', color: 'red', position: 3 },
  ],
});
