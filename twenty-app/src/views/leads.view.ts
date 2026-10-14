import {
  defineView,
  STANDARD_OBJECT,
  ViewFilterOperand,
  ViewSortDirection,
  ViewType,
} from 'twenty-sdk/define';

import {
  LEADS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_F_COMPANY_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_F_EMAILS_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_F_GRADE_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_F_NAME_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_F_SCORE_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_F_SOURCE_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_F_TITLE_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  LEADS_VIEW_UNIVERSAL_IDENTIFIER,
  PERSON_ICP_GRADE_UNIVERSAL_IDENTIFIER,
  PERSON_LEAD_SCORE_UNIVERSAL_IDENTIFIER,
  PERSON_LEAD_SOURCE_UNIVERSAL_IDENTIFIER,
  PERSON_LEAD_STATUS_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const personFields = STANDARD_OBJECT.person.fields;

// People who are still leads (not customers or disqualified), best fit first.
export default defineView({
  universalIdentifier: LEADS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Leads',
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: ViewType.TABLE,
  icon: 'IconFlame',
  position: 0,
  fields: [
    { universalIdentifier: LEADS_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: personFields.name.universalIdentifier, position: 0, size: 200 },
    { universalIdentifier: LEADS_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: PERSON_LEAD_STATUS_UNIVERSAL_IDENTIFIER, position: 1, size: 120 },
    { universalIdentifier: LEADS_VIEW_F_SCORE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: PERSON_LEAD_SCORE_UNIVERSAL_IDENTIFIER, position: 2, size: 100 },
    { universalIdentifier: LEADS_VIEW_F_GRADE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: PERSON_ICP_GRADE_UNIVERSAL_IDENTIFIER, position: 3, size: 100 },
    { universalIdentifier: LEADS_VIEW_F_TITLE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: personFields.jobTitle.universalIdentifier, position: 4, size: 180 },
    { universalIdentifier: LEADS_VIEW_F_COMPANY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: personFields.company.universalIdentifier, position: 5, size: 160 },
    { universalIdentifier: LEADS_VIEW_F_EMAILS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: personFields.emails.universalIdentifier, position: 6, size: 200 },
    { universalIdentifier: LEADS_VIEW_F_SOURCE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: PERSON_LEAD_SOURCE_UNIVERSAL_IDENTIFIER, position: 7, size: 130 },
  ],
  filters: [
    {
      universalIdentifier: LEADS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: PERSON_LEAD_STATUS_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      value: ['NEW', 'HOT', 'WARM', 'COLD', 'QUALIFIED'],
    },
  ],
  sorts: [
    {
      universalIdentifier: LEADS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: PERSON_LEAD_SCORE_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.DESC,
    },
  ],
});
