import { defineView, STANDARD_OBJECT, ViewFilterOperand, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import {
  LEAD_REVIEW_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_F_COMPANY_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_F_EMAILS_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_F_NAME_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_F_NOTES_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_F_SCORE_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_F_SUMMARY_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_F_TITLE_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  LEAD_REVIEW_VIEW_UNIVERSAL_IDENTIFIER,
  PERSON_QUALIFICATION_NOTES_UNIVERSAL_IDENTIFIER,
  PERSON_QUALIFICATION_STATUS_UNIVERSAL_IDENTIFIER,
} from 'src/constants/qualify-ids';
import { PERSON_AI_SUMMARY_UNIVERSAL_IDENTIFIER, PERSON_LEAD_SCORE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const personFields = STANDARD_OBJECT.person.fields;

// Borderline leads the gates held back, best score first. Set Qualification
// to Qualified to approve one for outreach, or Rejected to drop it.
export default defineView({
  universalIdentifier: LEAD_REVIEW_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Lead review',
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: ViewType.TABLE,
  icon: 'IconUserCheck',
  position: 1,
  fields: [
    { universalIdentifier: LEAD_REVIEW_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: personFields.name.universalIdentifier, position: 0, size: 180 },
    { universalIdentifier: LEAD_REVIEW_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: PERSON_QUALIFICATION_STATUS_UNIVERSAL_IDENTIFIER, position: 1, size: 120 },
    { universalIdentifier: LEAD_REVIEW_VIEW_F_SCORE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: PERSON_LEAD_SCORE_UNIVERSAL_IDENTIFIER, position: 2, size: 100 },
    { universalIdentifier: LEAD_REVIEW_VIEW_F_NOTES_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: PERSON_QUALIFICATION_NOTES_UNIVERSAL_IDENTIFIER, position: 3, size: 260 },
    { universalIdentifier: LEAD_REVIEW_VIEW_F_TITLE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: personFields.jobTitle.universalIdentifier, position: 4, size: 180 },
    { universalIdentifier: LEAD_REVIEW_VIEW_F_COMPANY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: personFields.company.universalIdentifier, position: 5, size: 160 },
    { universalIdentifier: LEAD_REVIEW_VIEW_F_EMAILS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: personFields.emails.universalIdentifier, position: 6, size: 200 },
    { universalIdentifier: LEAD_REVIEW_VIEW_F_SUMMARY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: PERSON_AI_SUMMARY_UNIVERSAL_IDENTIFIER, position: 7, size: 320 },
  ],
  filters: [
    {
      universalIdentifier: LEAD_REVIEW_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: PERSON_QUALIFICATION_STATUS_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      value: ['REVIEW'],
    },
  ],
  sorts: [
    {
      universalIdentifier: LEAD_REVIEW_VIEW_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: PERSON_LEAD_SCORE_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.DESC,
    },
  ],
});
