import { defineView, ViewType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';

export default defineView({
  universalIdentifier: ID.CAMPAIGNS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Campaigns',
  objectUniversalIdentifier: ID.CAMPAIGN_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconSpeakerphone',
  position: 0,
  fields: [
    { universalIdentifier: ID.CAMPAIGNS_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.CAMPAIGN_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 220 },
    { universalIdentifier: ID.CAMPAIGNS_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.CAMPAIGN_STATUS_UNIVERSAL_IDENTIFIER, position: 1, size: 110 },
    { universalIdentifier: ID.CAMPAIGNS_VIEW_F_ICP_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.CAMPAIGN_ICP_PROFILE_UNIVERSAL_IDENTIFIER, position: 2, size: 160 },
    { universalIdentifier: ID.CAMPAIGNS_VIEW_F_SEQUENCE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.CAMPAIGN_SEQUENCE_UNIVERSAL_IDENTIFIER, position: 3, size: 180 },
    { universalIdentifier: ID.CAMPAIGNS_VIEW_F_ENROLLED_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.CAMPAIGN_ENROLLED_UNIVERSAL_IDENTIFIER, position: 4, size: 100 },
    { universalIdentifier: ID.CAMPAIGNS_VIEW_F_SENT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.CAMPAIGN_SENT_UNIVERSAL_IDENTIFIER, position: 5, size: 90 },
    { universalIdentifier: ID.CAMPAIGNS_VIEW_F_REPLIED_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.CAMPAIGN_REPLIED_UNIVERSAL_IDENTIFIER, position: 6, size: 90 },
    { universalIdentifier: ID.CAMPAIGNS_VIEW_F_MEETINGS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: ID.CAMPAIGN_MEETINGS_UNIVERSAL_IDENTIFIER, position: 7, size: 100 },
  ],
});
