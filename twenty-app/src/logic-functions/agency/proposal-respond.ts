import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { PROPOSAL_RESPOND_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { parseRespondBody, proposalRespondResponse, renderMessagePage } from 'src/gtm/agency/proposals';
import { HTML_HEADERS, publicRecords } from 'src/logic-functions/agency/proposal-page';

// The proposal page's form posts here (POST /s/proposal/respond with t,
// action and comment, form-encoded or JSON). Records the answer, wins the deal
// on accept, adds a task for the team and shows a thank-you page.
const handler = async (event: RoutePayload) => {
  try {
    const { status, html } = await proposalRespondResponse({ records: publicRecords(), fields: parseRespondBody(event) });
    return new Response(html, { status, headers: HTML_HEADERS });
  } catch {
    return new Response(renderMessagePage('Something went wrong', 'Please go back and try again in a moment.'), { status: 500, headers: HTML_HEADERS });
  }
};

export default defineLogicFunction({
  universalIdentifier: PROPOSAL_RESPOND_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'proposal-respond',
  description: 'Records a client accepting, asking for changes to or declining a proposal',
  timeoutSeconds: 20,
  httpRouteTriggerSettings: { path: '/proposal/respond', httpMethod: 'POST', isAuthRequired: false },
  handler,
});
