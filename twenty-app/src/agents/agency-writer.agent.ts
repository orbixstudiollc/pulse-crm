import { defineAgent } from 'twenty-sdk/define';

import { AGENCY_WRITER_AGENT_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';

// Twenty built-in AI agent used by the agency automations (proposals, client
// emails, upsells) when AI_PROVIDER is twenty or unset. Each call carries its
// own instructions in the prompt; it has no tools.
export default defineAgent({
  universalIdentifier: AGENCY_WRITER_AGENT_UNIVERSAL_IDENTIFIER,
  name: 'agency-writer',
  label: 'Agency writer',
  icon: 'IconPencil',
  description: 'Writes proposals and client emails for Orbix from CRM facts',
  prompt:
    'You write for Orbix Studio, a design and development agency. Follow the instructions at the top of each message exactly and return only the JSON object they ask for.',
});
