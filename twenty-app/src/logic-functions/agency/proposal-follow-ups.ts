import { defineLogicFunction } from 'twenty-sdk/define';

import { PROPOSAL_FOLLOW_UPS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { proposalFollowUps } from 'src/gtm/agency/proposals';
import { agencyRecords, agencySettings, agencyWriter, errorText } from 'src/gtm/agency/runtime';

// Every morning: drafts a follow-up for proposals the client has not answered
// (3 days unread, 5 days after reading; at most two).
const handler = async () => {
  try {
    return await proposalFollowUps({ records: agencyRecords(), writer: await agencyWriter(), settings: agencySettings() });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: PROPOSAL_FOLLOW_UPS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'proposal-follow-ups',
  description: 'Drafts follow-ups for proposals the client has not answered',
  timeoutSeconds: 300,
  handler,
  cronTriggerSettings: { pattern: '0 9 * * *' },
});
