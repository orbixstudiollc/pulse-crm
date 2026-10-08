import { defineLogicFunction } from 'twenty-sdk/define';

import { ENROLL_QUALIFIED_FUNCTION_UNIVERSAL_IDENTIFIER, ENROLL_QUALIFIED_ROUTE_PATH } from 'src/constants/qualify-ids';
import { failure, toolOrRouteInput } from 'src/gtm/leadfinder/payload';
import { enrollQualified, type EnrollQualifiedInput } from 'src/gtm/qualify/enroll';
import { createQualifyStore } from 'src/gtm/qualify/twenty-store';
import { MAX_ENROLL_BATCH } from 'src/gtm/sequences/enroll';
import { createTwentyStore } from 'src/gtm/sequences/twenty-store';

// Enroll Qualified leads (best score first) in a sequence and campaign.
// Never automatic: you pick the sequence. dryRun counts who would go in.
export default defineLogicFunction({
  universalIdentifier: ENROLL_QUALIFIED_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'enroll-qualified-leads',
  description: `Enroll Qualified leads (verified email, not suppressed; best lead score first, up to ${MAX_ENROLL_BATCH}) in a sequence, optionally under a campaign, and mark them Enrolled. dryRun only counts.`,
  timeoutSeconds: 300,
  httpRouteTriggerSettings: { path: ENROLL_QUALIFIED_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        sequenceId: { type: 'string', description: 'Sequence to enroll them in' },
        campaignId: { type: 'string', description: 'Optional campaign to count them under' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ENROLL_BATCH, description: 'Most people to enroll in this call' },
        dryRun: { type: 'boolean', description: 'Only count who would be enrolled' },
      },
      required: ['sequenceId'],
    },
  },
  handler: async (payload: unknown) => {
    try {
      const input = toolOrRouteInput<EnrollQualifiedInput>(payload);
      return await enrollQualified({ store: createQualifyStore(), sequences: createTwentyStore(), input });
    } catch (error) {
      return failure(error);
    }
  },
});
