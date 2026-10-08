import { defineLogicFunction } from 'twenty-sdk/define';

import { QUALIFY_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER, QUALIFY_LEADS_ROUTE_PATH } from 'src/constants/qualify-ids';
import { failure, toolOrRouteInput } from 'src/gtm/leadfinder/payload';
import { qualifyPending } from 'src/gtm/qualify/run';
import { qualifyDeps } from 'src/gtm/qualify/runtime';

type Input = { requalifyPersonIds?: string[] };

// Every 5 minutes: research, classify and gate the next batch of Pending
// people. Also a tool and a route, to run now or to send people back through.
export default defineLogicFunction({
  universalIdentifier: QUALIFY_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'qualify-leads',
  description:
    'Qualify Pending leads: read the company website, classify the company and the job title against the active ICP, verify the email, check suppression, then mark each Qualified (85%+ on both), Review or Rejected and set lead score. Pass requalifyPersonIds to send people back through.',
  timeoutSeconds: 300,
  cronTriggerSettings: { pattern: '*/5 * * * *' },
  httpRouteTriggerSettings: { path: QUALIFY_LEADS_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        requalifyPersonIds: { type: 'array', items: { type: 'string' }, description: 'People to set back to Pending first' },
      },
    },
  },
  handler: async (payload: unknown) => {
    const input = toolOrRouteInput<Input>(payload);
    try {
      const deps = await qualifyDeps();
      const ids = Array.isArray(input.requalifyPersonIds) ? input.requalifyPersonIds.filter(Boolean).slice(0, 200) : [];
      // A company is researched once; clear its Website research date to have it looked at again.
      for (const id of ids) await deps.store.updatePerson(id, { qualificationStatus: 'PENDING' });
      return await qualifyPending(deps);
    } catch (error) {
      return failure(error);
    }
  },
});
