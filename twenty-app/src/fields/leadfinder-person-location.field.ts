import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_LOCATION_UNIVERSAL_IDENTIFIER } from 'src/constants/leadfinder-ids';

// Where the person is based ("London, England, United Kingdom"); read by ICP scoring.
export default defineField({
  universalIdentifier: PERSON_LOCATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'location',
  label: 'Location',
  icon: 'IconMapPin',
});
