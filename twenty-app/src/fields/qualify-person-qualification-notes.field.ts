import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_QUALIFICATION_NOTES_UNIVERSAL_IDENTIFIER } from 'src/constants/qualify-ids';

// Which gates a lead missed, one per line. Empty for Qualified leads.
export default defineField({
  universalIdentifier: PERSON_QUALIFICATION_NOTES_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'qualificationNotes',
  label: 'Qualification notes',
  icon: 'IconListCheck',
});
