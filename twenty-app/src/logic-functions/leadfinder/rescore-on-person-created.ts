import { defineLogicFunction } from 'twenty-sdk/define';

import { RESCORE_ON_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/leadfinder-ids';
import { handleRescoreEvent } from 'src/gtm/leadfinder/rescore-event';

export default defineLogicFunction({
  universalIdentifier: RESCORE_ON_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'rescore-on-person-created',
  description: 'Scores a new person against the active ICP profiles.',
  timeoutSeconds: 30,
  databaseEventTriggerSettings: {
    eventName: 'person.created',
  },
  handler: handleRescoreEvent,
});
