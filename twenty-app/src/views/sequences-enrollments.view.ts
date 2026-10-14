import { defineView, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

// Who is in which sequence and when their next step goes out.
export default defineView({
  universalIdentifier: ID.ENROLLMENTS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Enrollments',
  objectUniversalIdentifier: ID.ENROLLMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconUserCheck',
  position: 0,
  fields: [
    { universalIdentifier: ID.ENROLLMENTS_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 240 },
    { universalIdentifier: ID.ENROLLMENTS_VIEW_F_PERSON_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_PERSON_UNIVERSAL_IDENTIFIER, position: 1, size: 170 },
    { universalIdentifier: ID.ENROLLMENTS_VIEW_F_SEQUENCE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_SEQUENCE_UNIVERSAL_IDENTIFIER, position: 2, size: 170 },
    { universalIdentifier: ID.ENROLLMENTS_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_STATUS_UNIVERSAL_IDENTIFIER, position: 3, size: 110 },
    { universalIdentifier: ID.ENROLLMENTS_VIEW_F_STEP_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_CURRENT_STEP_UNIVERSAL_IDENTIFIER, position: 4, size: 100 },
    { universalIdentifier: ID.ENROLLMENTS_VIEW_F_NEXT_SEND_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_NEXT_SEND_AT_UNIVERSAL_IDENTIFIER, position: 5, size: 150 },
    { universalIdentifier: ID.ENROLLMENTS_VIEW_F_MAILBOX_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_MAILBOX_EMAIL_UNIVERSAL_IDENTIFIER, position: 6, size: 200 },
  ],
  sorts: [
    {
      universalIdentifier: ID.ENROLLMENTS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: ID.ENROLLMENT_NEXT_SEND_AT_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.ASC,
    },
  ],
});
