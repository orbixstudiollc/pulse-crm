import { defineField, FieldType, RelationType, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  PERSON_WEBSITE_VISITS_FIELD_ID,
  WEBSITE_VISIT_OBJECT_ID,
  WV_PERSON_FIELD_ID,
} from 'src/constants/insights-ids';

// Inverse side of websiteVisit.person, so a lead's page shows their visits.
export default defineField({
  universalIdentifier: PERSON_WEBSITE_VISITS_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'websiteVisits',
  label: 'Website visits',
  icon: 'IconWorldWww',
  relationTargetObjectMetadataUniversalIdentifier: WEBSITE_VISIT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: WV_PERSON_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
