import { defineView, ViewFilterOperand, ViewType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

// Review queue: AI-drafted openers waiting for approval. Edit the opener
// inline, then set Opener status to Approved.
export default defineView({
  universalIdentifier: ID.OPENERS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Openers to review',
  objectUniversalIdentifier: ID.ENROLLMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconSparkles',
  position: 1,
  fields: [
    { universalIdentifier: ID.OPENERS_VIEW_F_PERSON_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_PERSON_UNIVERSAL_IDENTIFIER, position: 0, size: 170 },
    { universalIdentifier: ID.OPENERS_VIEW_F_OPENER_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_PERSONALIZED_OPENER_UNIVERSAL_IDENTIFIER, position: 1, size: 380 },
    { universalIdentifier: ID.OPENERS_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_OPENER_STATUS_UNIVERSAL_IDENTIFIER, position: 2, size: 120 },
    { universalIdentifier: ID.OPENERS_VIEW_F_FIRST_LINE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_CUSTOM_FIRST_LINE_UNIVERSAL_IDENTIFIER, position: 3, size: 260 },
    { universalIdentifier: ID.OPENERS_VIEW_F_PS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_CUSTOM_PS_UNIVERSAL_IDENTIFIER, position: 4, size: 220 },
    { universalIdentifier: ID.OPENERS_VIEW_F_SEQUENCE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_SEQUENCE_UNIVERSAL_IDENTIFIER, position: 5, size: 170 },
    { universalIdentifier: ID.OPENERS_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.ENROLLMENT_NAME_UNIVERSAL_IDENTIFIER, position: 6, size: 220 },
  ],
  filters: [
    {
      universalIdentifier: ID.OPENERS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: ID.ENROLLMENT_OPENER_STATUS_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      value: ['DRAFT'],
    },
  ],
});
