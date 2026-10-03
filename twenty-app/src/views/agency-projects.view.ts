import { defineView, ViewFilterOperand, ViewType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineView({
  universalIdentifier: A.PROJECTS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Active projects',
  objectUniversalIdentifier: A.PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconFolder',
  position: 0,
  fields: [
    { universalIdentifier: A.PROJECTS_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROJECT_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 220 },
    { universalIdentifier: A.PROJECTS_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROJECT_STATUS_UNIVERSAL_IDENTIFIER, position: 1, size: 120 },
    { universalIdentifier: A.PROJECTS_VIEW_F_HEALTH_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROJECT_HEALTH_UNIVERSAL_IDENTIFIER, position: 2, size: 120 },
    { universalIdentifier: A.PROJECTS_VIEW_F_COMPANY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROJECT_COMPANY_UNIVERSAL_IDENTIFIER, position: 3, size: 170 },
    { universalIdentifier: A.PROJECTS_VIEW_F_SERVICE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROJECT_SERVICE_UNIVERSAL_IDENTIFIER, position: 4, size: 160 },
    { universalIdentifier: A.PROJECTS_VIEW_F_DUE_DATE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROJECT_DUE_DATE_UNIVERSAL_IDENTIFIER, position: 5, size: 110 },
    { universalIdentifier: A.PROJECTS_VIEW_F_LAST_UPDATE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROJECT_LAST_CLIENT_UPDATE_AT_UNIVERSAL_IDENTIFIER, position: 6, size: 150 },
    { universalIdentifier: A.PROJECTS_VIEW_F_VALUE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROJECT_VALUE_UNIVERSAL_IDENTIFIER, position: 7, size: 110 },
  ],
  filters: [
    {
      universalIdentifier: A.PROJECTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: A.PROJECT_STATUS_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      value: ['KICKOFF', 'IN_PROGRESS', 'IN_REVIEW', 'ON_HOLD'],
    },
  ],
});
