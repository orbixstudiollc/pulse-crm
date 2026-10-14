import { defineField, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// Person side of sequenceEnrollment.person: the sequences a person is in.
export default defineField({
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  ...oneToMany({
    universalIdentifier: ID.PERSON_SEQUENCE_ENROLLMENTS_UNIVERSAL_IDENTIFIER,
    name: 'sequenceEnrollments',
    label: 'Sequences',
    icon: 'IconRepeat',
    targetObject: ID.ENROLLMENT_OBJECT_UNIVERSAL_IDENTIFIER,
    targetField: ID.ENROLLMENT_PERSON_UNIVERSAL_IDENTIFIER,
  }),
});
