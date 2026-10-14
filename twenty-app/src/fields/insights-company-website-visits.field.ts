import { defineField, FieldType, RelationType, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  COMPANY_WEBSITE_VISITS_FIELD_ID,
  WEBSITE_VISIT_OBJECT_ID,
  WV_COMPANY_FIELD_ID,
} from 'src/constants/insights-ids';

// Inverse side of websiteVisit.company, so a company's page shows who from it visited.
export default defineField({
  universalIdentifier: COMPANY_WEBSITE_VISITS_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.RELATION,
  name: 'websiteVisits',
  label: 'Website visits',
  icon: 'IconWorldWww',
  relationTargetObjectMetadataUniversalIdentifier: WEBSITE_VISIT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: WV_COMPANY_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
