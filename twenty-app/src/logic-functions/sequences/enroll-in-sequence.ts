import { defineLogicFunction } from 'twenty-sdk/define';

import { ENROLL_IN_SEQUENCE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';
import { enrollPeople, MAX_ENROLL_BATCH, type EnrollInput } from 'src/gtm/sequences/enroll';
import { createTwentyStore } from 'src/gtm/sequences/twenty-store';

// Tool: put people into a sequence. Skips anyone already in it, without an
// email, or marked customer / disqualified, and says why.
const handler = async (input: EnrollInput) => {
  try {
    return { ok: true, ...(await enrollPeople({ store: createTwentyStore(), input })) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: ENROLL_IN_SEQUENCE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'enroll-in-sequence',
  description: `Enroll people (by person id, up to ${MAX_ENROLL_BATCH}) in an outreach sequence, optionally as part of a campaign. The first step is scheduled after its delay.`,
  timeoutSeconds: 60,
  handler,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        personIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ids of the people to enroll',
        },
        sequenceId: { type: 'string', description: 'Id of the sequence' },
        campaignId: {
          type: 'string',
          description: 'Optional campaign id; its enrolled / sent / replied counts are kept up to date',
        },
      },
      required: ['personIds', 'sequenceId'],
    },
  },
});
