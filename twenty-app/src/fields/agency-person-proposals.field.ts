import { defineField, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// Person side of the agency proposals relation.
export default defineField({
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  ...oneToMany({
    universalIdentifier: A.PERSON_PROPOSALS_UNIVERSAL_IDENTIFIER,
    name: 'proposals',
    label: 'Proposals',
    icon: 'IconFileText',
    targetObject: A.PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
    targetField: A.PROPOSAL_PERSON_UNIVERSAL_IDENTIFIER,
  }),
});
