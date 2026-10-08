import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_QUALIFICATION_STATUS_UNIVERSAL_IDENTIFIER } from 'src/constants/qualify-ids';
import { QUALIFICATION_STATUSES } from 'src/gtm/qualify/values';

// Where a lead is in qualification. Imports start as Pending; the qualifier
// sets Qualified, Review or Rejected; enrolling sets Enrolled. Set a Review
// lead to Qualified by hand to approve it for outreach.
export default defineField({
  universalIdentifier: PERSON_QUALIFICATION_STATUS_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'qualificationStatus',
  label: 'Qualification',
  icon: 'IconFilterCheck',
  options: QUALIFICATION_STATUSES.map((s, position) => ({ ...s, position })),
});
