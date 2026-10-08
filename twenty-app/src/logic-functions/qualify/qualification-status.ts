import { defineLogicFunction } from 'twenty-sdk/define';

import { QUALIFICATION_STATUS_FUNCTION_UNIVERSAL_IDENTIFIER, QUALIFICATION_STATUS_ROUTE_PATH } from 'src/constants/qualify-ids';
import { failure } from 'src/gtm/leadfinder/payload';
import { qualificationCounts } from 'src/gtm/qualify/twenty-store';

// Counts per qualification status and which tools are switched on, for the Setup page.
export default defineLogicFunction({
  universalIdentifier: QUALIFICATION_STATUS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'qualification-status',
  description: 'How many leads are Pending, Qualified, in Review, Rejected and Enrolled',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: { path: QUALIFICATION_STATUS_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  handler: async () => {
    try {
      return {
        ok: true,
        counts: await qualificationCounts(),
        tools: {
          firecrawl: Boolean(process.env.FIRECRAWL_API_KEY?.trim()),
          spider: Boolean(process.env.SPIDER_API_KEY?.trim()),
          jev: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
          prospeo: Boolean(process.env.PROSPEO_API_KEY?.trim()),
        },
      };
    } catch (error) {
      return failure(error);
    }
  },
});
