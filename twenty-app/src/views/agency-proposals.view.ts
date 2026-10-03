import { defineView, ViewType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineView({
  universalIdentifier: A.PROPOSALS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Proposals',
  objectUniversalIdentifier: A.PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconFileText',
  position: 0,
  fields: [
    { universalIdentifier: A.PROPOSALS_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROPOSAL_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 240 },
    { universalIdentifier: A.PROPOSALS_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROPOSAL_STATUS_UNIVERSAL_IDENTIFIER, position: 1, size: 130 },
    { universalIdentifier: A.PROPOSALS_VIEW_F_AMOUNT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROPOSAL_AMOUNT_UNIVERSAL_IDENTIFIER, position: 2, size: 110 },
    { universalIdentifier: A.PROPOSALS_VIEW_F_PERSON_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROPOSAL_PERSON_UNIVERSAL_IDENTIFIER, position: 3, size: 170 },
    { universalIdentifier: A.PROPOSALS_VIEW_F_OPPORTUNITY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROPOSAL_OPPORTUNITY_UNIVERSAL_IDENTIFIER, position: 4, size: 170 },
    { universalIdentifier: A.PROPOSALS_VIEW_F_SENT_AT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROPOSAL_SENT_AT_UNIVERSAL_IDENTIFIER, position: 5, size: 140 },
    { universalIdentifier: A.PROPOSALS_VIEW_F_VIEWED_AT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROPOSAL_VIEWED_AT_UNIVERSAL_IDENTIFIER, position: 6, size: 140 },
    { universalIdentifier: A.PROPOSALS_VIEW_F_FOLLOW_UPS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.PROPOSAL_FOLLOW_UPS_SENT_UNIVERSAL_IDENTIFIER, position: 7, size: 110 },
  ],
});
