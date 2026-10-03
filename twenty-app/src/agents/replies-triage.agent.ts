import { defineAgent } from 'twenty-sdk/define';

import { REPLY_TRIAGE_AGENT_UNIVERSAL_IDENTIFIER } from 'src/constants/replies-ids';
import { TRIAGE_INSTRUCTIONS } from 'src/gtm/replies/classify';
import { REPLY_INTENT_VALUES } from 'src/gtm/replies/values';

// Twenty built-in AI agent used by triage-reply when AI_PROVIDER is twenty or
// unset. It only reads the email and facts in the prompt; it has no tools.
export default defineAgent({
  universalIdentifier: REPLY_TRIAGE_AGENT_UNIVERSAL_IDENTIFIER,
  name: 'reply-triage',
  label: 'Reply triage',
  icon: 'IconMessageReply',
  description: 'Sorts a sequence reply by intent and drafts the answer',
  prompt: TRIAGE_INSTRUCTIONS,
  responseFormat: {
    type: 'json',
    schema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: `One of: ${REPLY_INTENT_VALUES.join(', ')}` },
        summary: { type: 'string', description: 'One short sentence' },
        draft: { type: 'string', description: 'Answer to send, or empty' },
        followUpDate: { type: 'string', description: 'YYYY-MM-DD or empty' },
        referralName: { type: 'string' },
        referralEmail: { type: 'string' },
      },
      required: ['intent', 'summary', 'draft'],
      additionalProperties: false,
    },
  },
});
