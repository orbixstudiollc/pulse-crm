import { defineLogicFunction } from 'twenty-sdk/define';

import { RESCORE_ON_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/leadfinder-ids';
import { handleRescoreEvent, RESCORE_INPUT_FIELDS } from 'src/gtm/leadfinder/rescore-event';

export default defineLogicFunction({
  universalIdentifier: RESCORE_ON_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'rescore-on-person-updated',
  description: "Rescores a person when their title, location or company changes. Writing the score itself does not re-trigger it.",
  timeoutSeconds: 30,
  databaseEventTriggerSettings: {
    eventName: 'person.updated',
    updatedFields: RESCORE_INPUT_FIELDS,
  },
  handler: handleRescoreEvent,
});
