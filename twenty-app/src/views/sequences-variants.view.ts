import { defineView, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

// A/B test results: every step variant with its numbers, best reply rate first.
export default defineView({
  universalIdentifier: ID.VARIANTS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'A/B tests',
  objectUniversalIdentifier: ID.VARIANT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconAB',
  position: 0,
  fields: [
    { universalIdentifier: ID.VARIANTS_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 180 },
    { universalIdentifier: ID.VARIANTS_VIEW_F_STEP_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_STEP_UNIVERSAL_IDENTIFIER, position: 1, size: 180 },
    { universalIdentifier: ID.VARIANTS_VIEW_F_WEIGHT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_WEIGHT_UNIVERSAL_IDENTIFIER, position: 2, size: 90 },
    { universalIdentifier: ID.VARIANTS_VIEW_F_SENT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_SENT_UNIVERSAL_IDENTIFIER, position: 3, size: 90 },
    { universalIdentifier: ID.VARIANTS_VIEW_F_OPENED_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_OPENED_UNIVERSAL_IDENTIFIER, position: 4, size: 90 },
    { universalIdentifier: ID.VARIANTS_VIEW_F_REPLIED_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_REPLIED_UNIVERSAL_IDENTIFIER, position: 5, size: 90 },
    { universalIdentifier: ID.VARIANTS_VIEW_F_OPEN_RATE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_OPEN_RATE_UNIVERSAL_IDENTIFIER, position: 6, size: 110 },
    { universalIdentifier: ID.VARIANTS_VIEW_F_REPLY_RATE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_REPLY_RATE_UNIVERSAL_IDENTIFIER, position: 7, size: 110 },
    { universalIdentifier: ID.VARIANTS_VIEW_F_WINNER_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_IS_WINNER_UNIVERSAL_IDENTIFIER, position: 8, size: 90 },
    { universalIdentifier: ID.VARIANTS_VIEW_F_ACTIVE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.VARIANT_IS_ACTIVE_UNIVERSAL_IDENTIFIER, position: 9, size: 90 },
  ],
  sorts: [
    {
      universalIdentifier: ID.VARIANTS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: ID.VARIANT_REPLY_RATE_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.DESC,
    },
  ],
});
