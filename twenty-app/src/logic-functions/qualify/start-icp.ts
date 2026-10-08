import { defineLogicFunction } from 'twenty-sdk/define';

import { START_ICP_FUNCTION_UNIVERSAL_IDENTIFIER, START_ICP_ROUTE_PATH } from 'src/constants/qualify-ids';
import { createRecords } from 'src/gtm/agency/gql';
import { failure, toolOrRouteInput } from 'src/gtm/leadfinder/payload';
import { startIcp, type StartIcpInput } from 'src/gtm/qualify/icp';

const stringList = (description: string) => ({ type: 'array' as const, items: { type: 'string' as const }, description });

// Creates a fresh ICP from a chat interview, turns it on and every other ICP off.
export default defineLogicFunction({
  universalIdentifier: START_ICP_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'start-icp',
  description:
    'Create a new ICP from the answers the user gave and make it the only active one (every other ICP is turned off). Lead search and qualification then use it. Call only after the user confirmed the summary.',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: { path: START_ICP_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short name, e.g. "US marketing agencies Oct 2026"' },
        description: {
          type: 'string',
          description: 'Who fits and who does not, in plain words. The qualifier reads this when it classifies each company, so include what the company must do and any exclusions.',
        },
        jobTitles: stringList('Decision-maker titles to target, e.g. "Founder", "CEO", "Managing Director"'),
        industries: stringList('Company industries or types, e.g. "Marketing agency"'),
        locations: stringList('Countries, states or cities, e.g. "United States"'),
        headcount: stringList('Company sizes: buckets 1-10, 11-20, 21-50, 51-100, 101-200, 201-500, 501-1000, 1001-2000, 2001-5000, 5001-10000, 10000+, or any range such as "11-50"'),
      },
    },
  },
  handler: async (payload: unknown) => {
    try {
      return await startIcp(createRecords(), toolOrRouteInput<StartIcpInput>(payload));
    } catch (error) {
      return failure(error);
    }
  },
});
