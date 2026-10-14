import { defineLogicFunction } from 'twenty-sdk/define';

import { ENRICH_VISITORS_FUNCTION_ID } from 'src/constants/insights-ids';
import { enrichWebsiteVisitors } from 'src/insights/enrich-visitors';
import { createVisitorEnrichDeps } from 'src/insights/enrich-visitors-runtime';

// Every 10 minutes: find the company behind new website visitors (work email
// or IP lookup), add its ICP people as leads with Prospeo, and put new leads
// and form fills into the "Website visitors" sequence.
export default defineLogicFunction({
  universalIdentifier: ENRICH_VISITORS_FUNCTION_ID,
  name: 'enrich-website-visitors',
  description:
    'Identifies the companies behind new website visitors, adds their ICP decision makers as leads (Prospeo) and enrolls them in the Website visitors sequence',
  timeoutSeconds: 300,
  cronTriggerSettings: { pattern: '*/10 * * * *' },
  handler: async () => enrichWebsiteVisitors(createVisitorEnrichDeps()),
});
