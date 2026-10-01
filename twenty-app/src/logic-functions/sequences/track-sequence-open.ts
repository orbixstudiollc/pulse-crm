import { defineLogicFunction } from 'twenty-sdk/define';
import { kv, Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { TRACK_OPEN_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';
import { recordOpen } from 'src/gtm/sequences/record-open';
import { createTwentyStore } from 'src/gtm/sequences/twenty-store';

// Public open-tracking pixel: GET /sequences/open?e=<enrollmentId>&v=<variantId>.
// Its public URL goes in OutreachMailer.openTrackingUrl. Answers 204 with no
// body (an invisible "image") whatever happens, so mail clients never show an
// error.
const handler = async (event: RoutePayload) => {
  try {
    await recordOpen({
      store: createTwentyStore(),
      seen: { get: (k) => kv.get(k), set: (k, v) => kv.set(k, v) },
      enrollmentId: event.queryStringParameters?.e,
      variantId: event.queryStringParameters?.v,
    });
  } catch {
    // Tracking must never fail the request.
  }
  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
};

export default defineLogicFunction({
  universalIdentifier: TRACK_OPEN_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'track-sequence-open',
  description: 'Open-tracking pixel for sequence emails (counts opens per A/B variant)',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: { path: '/sequences/open', httpMethod: 'GET', isAuthRequired: false },
});
