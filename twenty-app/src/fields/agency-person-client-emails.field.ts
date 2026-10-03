import { defineField, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// Person side of the agency client emails relation.
export default defineField({
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  ...oneToMany({
    universalIdentifier: A.PERSON_CLIENT_EMAILS_UNIVERSAL_IDENTIFIER,
    name: 'clientEmails',
    label: 'Client emails',
    icon: 'IconMailForward',
    targetObject: A.CLIENT_EMAIL_OBJECT_UNIVERSAL_IDENTIFIER,
    targetField: A.CLIENT_EMAIL_PERSON_UNIVERSAL_IDENTIFIER,
  }),
});
