import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { PROPOSAL_PAGE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { createRecords } from 'src/gtm/agency/gql';
import { proposalPageResponse, renderMessagePage } from 'src/gtm/agency/proposals';
import { agencySettings } from 'src/gtm/agency/runtime';
import type { GraphqlClient } from 'src/gtm/sequences/twenty-store';

// Public proposal page (GET /s/proposal?t=<token>). No one is logged in, so
// records are read as the application. Opening it records the client's view.

export const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

export const publicRecords = () => createRecords(new CoreApiClient({ runAs: 'application' }) as unknown as GraphqlClient);

const handler = async (event: RoutePayload) => {
  try {
    const { status, html } = await proposalPageResponse({
      records: publicRecords(),
      settings: agencySettings(),
      token: event.queryStringParameters?.t,
    });
    return new Response(html, { status, headers: HTML_HEADERS });
  } catch {
    return new Response(renderMessagePage('Something went wrong', 'Please try again in a moment.'), { status: 500, headers: HTML_HEADERS });
  }
};

export default defineLogicFunction({
  universalIdentifier: PROPOSAL_PAGE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'proposal-page',
  description: 'Public page where a client reads a proposal and answers it',
  timeoutSeconds: 20,
  httpRouteTriggerSettings: { path: '/proposal', httpMethod: 'GET', isAuthRequired: false },
  handler,
});
