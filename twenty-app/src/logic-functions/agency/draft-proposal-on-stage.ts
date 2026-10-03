import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { DRAFT_PROPOSAL_ON_STAGE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { draftProposal } from 'src/gtm/agency/proposals';
import { agencyRecords, agencySettings, agencyWriter, errorText } from 'src/gtm/agency/runtime';

type DealEvent = { id?: string; stage?: string | null };

// Moving a deal to "Proposal" drafts the proposal from the discovery-call
// notes. draftProposal skips deals that already have one, so moving the deal
// back and forth (or the draft itself moving it) does not draft twice.
const handler = async (event: DatabaseEventPayload) => {
  const { before, after } = (event.properties ?? {}) as { before?: DealEvent; after?: DealEvent };
  if (!after?.id || after.stage !== 'PROPOSAL' || before?.stage === 'PROPOSAL') return { ok: true, skipped: 'Not moved to Proposal' };
  try {
    return await draftProposal({
      records: agencyRecords(),
      writer: await agencyWriter(),
      settings: agencySettings(),
      opportunityId: after.id,
    });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: DRAFT_PROPOSAL_ON_STAGE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'draft-proposal-on-stage',
  description: 'Drafts a proposal when a deal moves to the Proposal stage',
  timeoutSeconds: 180,
  handler,
  databaseEventTriggerSettings: { eventName: 'opportunity.updated', updatedFields: ['stage'] },
});
