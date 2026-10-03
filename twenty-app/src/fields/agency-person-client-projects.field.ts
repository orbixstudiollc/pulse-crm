import { defineField, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// Person side of the agency projects relation.
export default defineField({
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  ...oneToMany({
    universalIdentifier: A.PERSON_PROJECTS_UNIVERSAL_IDENTIFIER,
    name: 'clientProjects',
    label: 'Projects',
    icon: 'IconFolder',
    targetObject: A.PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
    targetField: A.PROJECT_PERSON_UNIVERSAL_IDENTIFIER,
  }),
});
