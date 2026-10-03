import { defineLogicFunction } from 'twenty-sdk/define';

import { DRAFT_PROPOSAL_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { draftProposal } from 'src/gtm/agency/proposals';
import { agencyRecords, agencySettings, agencyWriter, errorText } from 'src/gtm/agency/runtime';

type ToolInput = { opportunityId?: string; notes?: string; force?: boolean };

// Drafts a proposal for one deal on request (AI chat or a workflow), with
// optional extra notes. Skips deals that already have a live proposal unless
// forced.
const handler = async (input: ToolInput) => {
  if (!input?.opportunityId) return { ok: false, error: 'opportunityId is required' };
  try {
    return await draftProposal({
      records: agencyRecords(),
      writer: await agencyWriter(),
      settings: agencySettings(),
      opportunityId: input.opportunityId,
      notes: input.notes ?? null,
      force: Boolean(input.force),
    });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: DRAFT_PROPOSAL_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'draft-proposal',
  description:
    'Drafts a client proposal for a deal from its call notes, the contact\'s emails and the service catalog, with the email that sends the client link.',
  timeoutSeconds: 180,
  handler,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        opportunityId: { type: 'string', description: 'Deal (opportunity) to write the proposal for' },
        notes: { type: 'string', description: 'Extra notes from the discovery call to take into account' },
        force: { type: 'boolean', description: 'Draft a new proposal even if the deal already has one' },
      },
      required: ['opportunityId'],
    },
  },
});
