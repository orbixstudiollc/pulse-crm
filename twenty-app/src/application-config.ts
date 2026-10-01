import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { PROSPEO_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER } from 'src/constants/leadfinder-ids';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    PROSPEO_API_KEY: {
      universalIdentifier: PROSPEO_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Prospeo API key',
      description: 'Used by Lead Finder to search and enrich people. From app.prospeo.io > API.',
      isSecret: true,
    },
  },
});
