import { defineLogicFunction } from 'twenty-sdk/define';

import { WEEKLY_CLIENT_UPDATES_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { weeklyClientUpdates } from 'src/gtm/agency/client-updates';
import { agencyRecords, agencySettings, agencyWriter, errorText } from 'src/gtm/agency/runtime';

type ToolInput = { projectId?: string; force?: boolean };

// Monday 08:00: health flags and a drafted status email for every active
// project. As a tool, runs for one project now.
const handler = async (input?: ToolInput) => {
  try {
    return await weeklyClientUpdates({
      records: agencyRecords(),
      writer: await agencyWriter(),
      settings: agencySettings(),
      projectId: typeof input?.projectId === 'string' && input.projectId ? input.projectId : undefined,
      force: input?.force === true,
    });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: WEEKLY_CLIENT_UPDATES_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'weekly-client-updates',
  description:
    'Flags each active project On track, At risk or Quiet client, creates a task for the team when it needs attention, and drafts the weekly status email to the client.',
  timeoutSeconds: 300,
  handler,
  cronTriggerSettings: { pattern: '0 8 * * 1' },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Run for this project only (default: every active project)' },
        force: { type: 'boolean', description: 'Draft even if an update was sent or drafted in the last 6 days' },
      },
    },
  },
});
