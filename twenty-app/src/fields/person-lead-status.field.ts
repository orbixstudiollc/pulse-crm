import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_LEAD_STATUS_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { LEAD_STATUSES } from 'src/gtm/lead-values';

// GTM fields Pulse adds to Twenty's standard People object. A "lead" in Pulse
// is a Person with a lead status; converting a lead just moves the status on.

const person = STANDARD_OBJECT.person.universalIdentifier;

export default defineField({
  universalIdentifier: PERSON_LEAD_STATUS_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: person,
  type: FieldType.SELECT,
  name: 'leadStatus',
  label: 'Lead status',
  icon: 'IconFlame',
  options: LEAD_STATUSES.map((s, position) => ({ ...s, position })),
});
