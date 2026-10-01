import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { PROSPEO_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER } from 'src/constants/leadfinder-ids';
import { MAILBOX_APPLICATION_VARIABLES } from 'src/gtm/mailbox/app-variables';
import { SEQUENCES_APPLICATION_VARIABLES } from 'src/gtm/sequences/app-variables';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    ...MAILBOX_APPLICATION_VARIABLES,
    ...SEQUENCES_APPLICATION_VARIABLES,
    PROSPEO_API_KEY: {
      universalIdentifier: PROSPEO_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Prospeo API key',
      description: 'Used by Lead Finder to search and enrich people. From app.prospeo.io > API.',
      isSecret: true,
    },
  },
});
