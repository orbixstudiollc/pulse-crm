import { defineField } from 'twenty-sdk/define';

import { ICP_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import * as ID from 'src/constants/sequences-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// ICP side of campaign.icpProfile. Kept as a separate field so the ICP object
// file stays untouched.
export default defineField({
  objectUniversalIdentifier: ICP_OBJECT_UNIVERSAL_IDENTIFIER,
  ...oneToMany({
    universalIdentifier: ID.ICP_PROFILE_CAMPAIGNS_UNIVERSAL_IDENTIFIER,
    name: 'campaigns',
    label: 'Campaigns',
    icon: 'IconSpeakerphone',
    targetObject: ID.CAMPAIGN_OBJECT_UNIVERSAL_IDENTIFIER,
    targetField: ID.CAMPAIGN_ICP_PROFILE_UNIVERSAL_IDENTIFIER,
  }),
});
