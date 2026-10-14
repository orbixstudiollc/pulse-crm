import { defineView, ViewType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineView({
  universalIdentifier: ID.TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Templates',
  objectUniversalIdentifier: ID.EMAIL_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconTemplate',
  position: 0,
  fields: [
    { universalIdentifier: ID.TEMPLATES_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.EMAIL_TEMPLATE_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 220 },
    { universalIdentifier: ID.TEMPLATES_VIEW_F_CATEGORY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.EMAIL_TEMPLATE_CATEGORY_UNIVERSAL_IDENTIFIER, position: 1, size: 140 },
    { universalIdentifier: ID.TEMPLATES_VIEW_F_SUBJECT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.EMAIL_TEMPLATE_SUBJECT_UNIVERSAL_IDENTIFIER, position: 2, size: 260 },
    { universalIdentifier: ID.TEMPLATES_VIEW_F_BODY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.EMAIL_TEMPLATE_BODY_UNIVERSAL_IDENTIFIER, position: 3, size: 360 },
  ],
});
