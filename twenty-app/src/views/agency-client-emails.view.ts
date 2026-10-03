import { defineView, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineView({
  universalIdentifier: A.CLIENT_EMAILS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Client emails',
  objectUniversalIdentifier: A.CLIENT_EMAIL_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconMailForward',
  position: 0,
  fields: [
    { universalIdentifier: A.CLIENT_EMAILS_VIEW_F_SUBJECT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.CLIENT_EMAIL_SUBJECT_UNIVERSAL_IDENTIFIER, position: 0, size: 260 },
    { universalIdentifier: A.CLIENT_EMAILS_VIEW_F_KIND_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.CLIENT_EMAIL_KIND_UNIVERSAL_IDENTIFIER, position: 1, size: 140 },
    { universalIdentifier: A.CLIENT_EMAILS_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.CLIENT_EMAIL_STATUS_UNIVERSAL_IDENTIFIER, position: 2, size: 110 },
    { universalIdentifier: A.CLIENT_EMAILS_VIEW_F_TO_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.CLIENT_EMAIL_TO_UNIVERSAL_IDENTIFIER, position: 3, size: 200 },
    { universalIdentifier: A.CLIENT_EMAILS_VIEW_F_PERSON_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.CLIENT_EMAIL_PERSON_UNIVERSAL_IDENTIFIER, position: 4, size: 160 },
    { universalIdentifier: A.CLIENT_EMAILS_VIEW_F_PROJECT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.CLIENT_EMAIL_PROJECT_UNIVERSAL_IDENTIFIER, position: 5, size: 160 },
    { universalIdentifier: A.CLIENT_EMAILS_VIEW_F_SENT_AT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.CLIENT_EMAIL_SENT_AT_UNIVERSAL_IDENTIFIER, position: 6, size: 140 },
  ],
  sorts: [
    {
      universalIdentifier: A.CLIENT_EMAILS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: A.CLIENT_EMAIL_STATUS_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.ASC,
    },
  ],
});
