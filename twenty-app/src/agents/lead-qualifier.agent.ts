import { defineAgent } from 'twenty-sdk/define';

import { LEAD_QUALIFIER_AGENT_UNIVERSAL_IDENTIFIER } from 'src/constants/qualify-ids';

// Twenty built-in AI agent used to classify companies and job titles when
// AI_PROVIDER is twenty or unset. Each call carries its own instructions; it has no tools.
export default defineAgent({
  universalIdentifier: LEAD_QUALIFIER_AGENT_UNIVERSAL_IDENTIFIER,
  name: 'lead-qualifier',
  label: 'Lead qualifier',
  icon: 'IconFilterCheck',
  description: 'Classifies companies and job titles against the ICP for lead qualification',
  prompt:
    'You qualify B2B leads. Follow the instructions at the top of each message exactly and return only the JSON object they ask for.',
});
