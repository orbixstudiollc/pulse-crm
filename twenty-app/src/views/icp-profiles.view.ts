import { defineView, ViewType } from 'twenty-sdk/define';

import {
  ICP_HEADCOUNT_UNIVERSAL_IDENTIFIER,
  ICP_INDUSTRIES_UNIVERSAL_IDENTIFIER,
  ICP_IS_ACTIVE_UNIVERSAL_IDENTIFIER,
  ICP_JOB_TITLES_UNIVERSAL_IDENTIFIER,
  ICP_NAME_UNIVERSAL_IDENTIFIER,
  ICP_OBJECT_UNIVERSAL_IDENTIFIER,
  ICP_VIEW_F_ACTIVE_UNIVERSAL_IDENTIFIER,
  ICP_VIEW_F_HEADCOUNT_UNIVERSAL_IDENTIFIER,
  ICP_VIEW_F_INDUSTRIES_UNIVERSAL_IDENTIFIER,
  ICP_VIEW_F_NAME_UNIVERSAL_IDENTIFIER,
  ICP_VIEW_F_TITLES_UNIVERSAL_IDENTIFIER,
  ICP_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineView({
  universalIdentifier: ICP_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'All ICPs',
  objectUniversalIdentifier: ICP_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconTarget',
  position: 0,
  fields: [
    { universalIdentifier: ICP_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ICP_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 200 },
    { universalIdentifier: ICP_VIEW_F_TITLES_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ICP_JOB_TITLES_UNIVERSAL_IDENTIFIER, position: 1, size: 220 },
    { universalIdentifier: ICP_VIEW_F_INDUSTRIES_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ICP_INDUSTRIES_UNIVERSAL_IDENTIFIER, position: 2, size: 220 },
    { universalIdentifier: ICP_VIEW_F_HEADCOUNT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ICP_HEADCOUNT_UNIVERSAL_IDENTIFIER, position: 3, size: 160 },
    { universalIdentifier: ICP_VIEW_F_ACTIVE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ICP_IS_ACTIVE_UNIVERSAL_IDENTIFIER, position: 4, size: 90 },
  ],
});
