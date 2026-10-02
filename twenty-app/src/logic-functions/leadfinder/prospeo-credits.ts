import { defineLogicFunction } from 'twenty-sdk/define';

import { PROSPEO_CREDITS_FUNCTION_UNIVERSAL_IDENTIFIER, PROSPEO_CREDITS_ROUTE_PATH } from 'src/constants/leadfinder-ids';
import { failure } from 'src/gtm/leadfinder/payload';
import { getAccountInfo } from 'src/gtm/prospeo/api';
import { getProspeoKey } from 'src/gtm/prospeo/client';

// Route behind the Setup page and AI tool: Prospeo credits left, plan and renewal date.
const handler = async () => {
  try {
    return { ok: true as const, ...(await getAccountInfo(getProspeoKey())) };
  } catch (error) {
    return failure(error);
  }
};

export default defineLogicFunction({
  universalIdentifier: PROSPEO_CREDITS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'prospeo-credits',
  description: 'Shows how many Prospeo credits are left, the plan and when the credits renew. Costs no credits.',
  timeoutSeconds: 30,
  toolTriggerSettings: { inputSchema: { type: 'object', properties: {} } },
  httpRouteTriggerSettings: { path: PROSPEO_CREDITS_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  handler,
});
