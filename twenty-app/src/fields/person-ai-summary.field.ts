import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_AI_SUMMARY_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const person = STANDARD_OBJECT.person.universalIdentifier;

export default defineField({
  universalIdentifier: PERSON_AI_SUMMARY_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: person,
  type: FieldType.TEXT,
  name: 'aiSummary',
  label: 'AI summary',
  description: 'Why this person fits, and how to open the conversation',
  icon: 'IconSparkles',
});
