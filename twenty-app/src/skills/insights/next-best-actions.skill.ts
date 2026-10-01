import { defineSkill } from 'twenty-sdk/define';

import { SKILL_NEXT_STEPS_ID } from 'src/constants/insights-ids';

export default defineSkill({
  universalIdentifier: SKILL_NEXT_STEPS_ID,
  name: 'next-best-actions',
  label: 'Next best actions',
  icon: 'IconListCheck',
  description: 'Suggest the next steps for a lead, a deal or the whole pipeline',
  content: `# Next best actions

Goal: 3-5 concrete actions, each with who, what and by when.

For a lead:
- No email or company data -> enrichLead.
- No score or grade -> scoreLeads.
- HOT or grade A and not contacted -> draft outreach today (outreach-drafting skill).
- Contacted, no reply after 3+ days -> follow-up draft or enrollInSequence (ask first).
- Returning website visitor -> reach out referencing what they read.
- Clear misfit -> propose leadStatus DISQUALIFIED (ask first).

For a deal:
- closeDate in the past -> confirm status or move the date.
- No activity in 14 days -> re-engage the point of contact.
- Stuck in one stage -> name the blocker and the step that moves it.
- No point of contact -> find the decision maker at the company.

For the whole pipeline: list the 3 deals most at risk and the 3 leads most worth calling, then the actions above for each.

Write actions as imperative one-liners ("Email Ada at Acme about the pricing page visit today"). Propose record changes; never apply bulk changes without the user's yes.`,
});
