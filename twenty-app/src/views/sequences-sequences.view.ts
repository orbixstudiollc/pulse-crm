import { defineView, ViewType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineView({
  universalIdentifier: ID.SEQUENCES_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Sequences',
  objectUniversalIdentifier: ID.SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconRepeat',
  position: 0,
  fields: [
    { universalIdentifier: ID.SEQUENCES_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.SEQUENCE_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 220 },
    { universalIdentifier: ID.SEQUENCES_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.SEQUENCE_STATUS_UNIVERSAL_IDENTIFIER, position: 1, size: 110 },
    { universalIdentifier: ID.SEQUENCES_VIEW_F_STEPS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.SEQUENCE_STEPS_UNIVERSAL_IDENTIFIER, position: 2, size: 200 },
    { universalIdentifier: ID.SEQUENCES_VIEW_F_ENROLLMENTS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.SEQUENCE_ENROLLMENTS_UNIVERSAL_IDENTIFIER, position: 3, size: 200 },
    { universalIdentifier: ID.SEQUENCES_VIEW_F_BUSINESS_DAYS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.SEQUENCE_BUSINESS_DAYS_ONLY_UNIVERSAL_IDENTIFIER, position: 4, size: 130 },
    { universalIdentifier: ID.SEQUENCES_VIEW_F_DESCRIPTION_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.SEQUENCE_DESCRIPTION_UNIVERSAL_IDENTIFIER, position: 5, size: 260 },
  ],
});
