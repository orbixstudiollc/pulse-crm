import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { KICKOFF_WON_DEAL_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { kickoffWonDeal } from 'src/gtm/agency/kickoff';
import { agencyRecords, agencySettings, agencyWriter, errorText } from 'src/gtm/agency/runtime';

type DealRow = { id?: string; stage?: string | null };
type ToolInput = { opportunityId?: string };

// Runs when a deal moves to Customer (won): projects, kickoff tasks, deposit
// invoice draft and welcome email. Also a tool to kick off one deal by hand.
const handler = async (input: DatabaseEventPayload | ToolInput) => {
  const tool = input as ToolInput;
  const props = (input as DatabaseEventPayload).properties as { before?: DealRow; after?: DealRow } | undefined;
  let opportunityId = tool.opportunityId;
  if (!opportunityId) {
    const { before, after } = props ?? {};
    if (!after?.id) return { ok: true, skipped: 'No deal id' };
    if (after.stage !== 'CUSTOMER' || before?.stage === 'CUSTOMER') return { ok: true, skipped: 'Not newly won' };
    opportunityId = after.id;
  }
  try {
    const writer = await agencyWriter().catch(() => null);
    return await kickoffWonDeal({ records: agencyRecords(), writer, settings: agencySettings(), opportunityId });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: KICKOFF_WON_DEAL_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'kickoff-won-deal',
  description:
    'When a deal is won: creates the client projects with their kickoff tasks, marks the contact a customer, drafts the deposit invoice and the welcome email.',
  timeoutSeconds: 180,
  handler,
  databaseEventTriggerSettings: { eventName: 'opportunity.updated', updatedFields: ['stage'] },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: { opportunityId: { type: 'string', description: 'Won deal (opportunity) to kick off' } },
      required: ['opportunityId'],
    },
  },
});
