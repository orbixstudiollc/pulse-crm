import { defineView, ViewType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineView({
  universalIdentifier: A.SERVICES_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Services',
  objectUniversalIdentifier: A.SERVICE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconBriefcase',
  position: 0,
  fields: [
    { universalIdentifier: A.SERVICES_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.SERVICE_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 200 },
    { universalIdentifier: A.SERVICES_VIEW_F_CATEGORY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.SERVICE_CATEGORY_UNIVERSAL_IDENTIFIER, position: 1, size: 120 },
    { universalIdentifier: A.SERVICES_VIEW_F_PRICE_FROM_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.SERVICE_PRICE_FROM_UNIVERSAL_IDENTIFIER, position: 2, size: 110 },
    { universalIdentifier: A.SERVICES_VIEW_F_PRICE_TO_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.SERVICE_PRICE_TO_UNIVERSAL_IDENTIFIER, position: 3, size: 110 },
    { universalIdentifier: A.SERVICES_VIEW_F_WEEKS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.SERVICE_DELIVERY_WEEKS_UNIVERSAL_IDENTIFIER, position: 4, size: 110 },
    { universalIdentifier: A.SERVICES_VIEW_F_NEXT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.SERVICE_NEXT_SERVICE_UNIVERSAL_IDENTIFIER, position: 5, size: 170 },
    { universalIdentifier: A.SERVICES_VIEW_F_ACTIVE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.SERVICE_IS_ACTIVE_UNIVERSAL_IDENTIFIER, position: 6, size: 80 },
  ],
});
