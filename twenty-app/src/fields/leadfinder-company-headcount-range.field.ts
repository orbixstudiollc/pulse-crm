import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { COMPANY_HEADCOUNT_RANGE_UNIVERSAL_IDENTIFIER } from 'src/constants/leadfinder-ids';

// Company size bucket as Prospeo reports it ("51-100"); read by ICP scoring.
export default defineField({
  universalIdentifier: COMPANY_HEADCOUNT_RANGE_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'headcountRange',
  label: 'Company size',
  description: 'Employee range, e.g. 51-100',
  icon: 'IconUsers',
});
