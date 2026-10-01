import { defineLogicFunction } from 'twenty-sdk/define';
import { runAgent } from 'twenty-sdk/logic-function';

import {
  GENERATE_OPENERS_FUNCTION_UNIVERSAL_IDENTIFIER,
  OPENER_WRITER_AGENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/sequences-ids';
import {
  generateOpeners,
  MAX_OPENERS_PER_CALL,
  type GenerateOpenersInput,
} from 'src/gtm/sequences/generate-openers';
import { pickOpenerWriter } from 'src/gtm/sequences/opener-writers';
import { createTwentyStore } from 'src/gtm/sequences/twenty-store';

// Tool: draft personalised openers for people's active enrollments (or given
// enrollments). Drafts are saved as DRAFT for review in "Openers to review".
const handler = async (input: GenerateOpenersInput) => {
  try {
    const writer = pickOpenerWriter(process.env, runAgent, OPENER_WRITER_AGENT_UNIVERSAL_IDENTIFIER);
    return { ok: true, ...(await generateOpeners({ store: createTwentyStore(), writer, input })) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: GENERATE_OPENERS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'generate-openers',
  description: `Draft personalised email openers ({{opener}}) from each person's job title, company, AI summary, website visits and notes. Up to ${MAX_OPENERS_PER_CALL} per call; saved as drafts to review.`,
  timeoutSeconds: 300,
  handler,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        personIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'People whose active enrollments get an opener',
        },
        enrollmentIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific enrollments to write openers for',
        },
        style: {
          type: 'string',
          description: 'Optional style guidance, e.g. "casual, mention their hiring"',
        },
        overwriteApproved: {
          type: 'boolean',
          description: 'Also redo openers that were already approved',
        },
      },
    },
  },
});
