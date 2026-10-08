import { defineSkill } from 'twenty-sdk/define';

import { FIND_LEADS_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/qualify-ids';
import { FIND_LEADS_GUIDE } from 'src/gtm/qualify/find-leads-guide';

export default defineSkill({
  universalIdentifier: FIND_LEADS_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'find-leads',
  label: 'Find leads',
  icon: 'IconUserSearch',
  description: 'Use when the user says "find leads": build a fresh ICP by asking questions, then find leads in Prospeo and qualify them',
  content: FIND_LEADS_GUIDE,
});
