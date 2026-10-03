import { defineField, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// Opportunity side of the agency proposals relation.
export default defineField({
  objectUniversalIdentifier: STANDARD_OBJECT.opportunity.universalIdentifier,
  ...oneToMany({
    universalIdentifier: A.OPPORTUNITY_PROPOSALS_UNIVERSAL_IDENTIFIER,
    name: 'proposals',
    label: 'Proposals',
    icon: 'IconFileText',
    targetObject: A.PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
    targetField: A.PROPOSAL_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  }),
});
