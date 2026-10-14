import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { COMPANY_INDUSTRY_UNIVERSAL_IDENTIFIER } from 'src/constants/leadfinder-ids';

// Filled by Lead Finder from Prospeo; read by ICP scoring.
export default defineField({
  universalIdentifier: COMPANY_INDUSTRY_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'industry',
  label: 'Industry',
  icon: 'IconBuildingFactory2',
});
