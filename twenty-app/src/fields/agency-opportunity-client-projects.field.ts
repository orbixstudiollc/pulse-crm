import { defineField, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// Opportunity side of the agency projects relation.
export default defineField({
  objectUniversalIdentifier: STANDARD_OBJECT.opportunity.universalIdentifier,
  ...oneToMany({
    universalIdentifier: A.OPPORTUNITY_PROJECTS_UNIVERSAL_IDENTIFIER,
    name: 'clientProjects',
    label: 'Projects',
    icon: 'IconFolder',
    targetObject: A.PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
    targetField: A.PROJECT_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  }),
});
