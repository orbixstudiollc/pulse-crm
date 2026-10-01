import { defineAgent } from 'twenty-sdk/define';

import { OPENER_WRITER_AGENT_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';
import { OPENER_INSTRUCTIONS } from 'src/gtm/sequences/openers';

// Twenty built-in AI agent used by generate-openers when no ANTHROPIC_API_KEY
// is set. It only reads the facts in the prompt; it has no tools.
export default defineAgent({
  universalIdentifier: OPENER_WRITER_AGENT_UNIVERSAL_IDENTIFIER,
  name: 'sequence-opener-writer',
  label: 'Opener writer',
  icon: 'IconSparkles',
  description: 'Drafts a personalised first line for a sequence email',
  prompt: OPENER_INSTRUCTIONS,
  responseFormat: {
    type: 'json',
    schema: {
      type: 'object',
      properties: {
        opener: { type: 'string', description: 'One-sentence personalised opener' },
        firstLine: { type: 'string', description: 'Optional alternative first line' },
        ps: { type: 'string', description: 'Optional P.S., or empty' },
      },
      required: ['opener'],
      additionalProperties: false,
    },
  },
});
