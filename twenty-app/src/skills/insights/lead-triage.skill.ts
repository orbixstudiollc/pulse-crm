import { defineSkill } from 'twenty-sdk/define';

import { SKILL_LEAD_TRIAGE_ID } from 'src/constants/insights-ids';

export default defineSkill({
  universalIdentifier: SKILL_LEAD_TRIAGE_ID,
  name: 'lead-triage',
  label: 'Lead triage',
  icon: 'IconFlame',
  description: 'Rank open leads and say who to contact today and why',
  content: `# Lead triage

Goal: a short, ranked list of the leads most worth contacting today.

1. Read open leads: people whose leadStatus is NEW, HOT, WARM or QUALIFIED. Skip CUSTOMER and DISQUALIFIED.
2. If many leads have no leadScore or icpGrade, offer to run scoreLeads on them first (ask before running it on more than 25 people).
3. Rank by, in order:
   - leadStatus HOT first, then QUALIFIED, WARM, NEW.
   - icpGrade A before B before C before D.
   - leadScore, highest first.
   - Recent website visits linked to the person (websiteVisit.person), more pageViews and a recent visitedAt rank higher.
   - Leads never contacted before leads touched in the last 3 days.
4. Return the top 5 (or what the user asked for) as a list: name, company, title, status, grade/score, and one line on why now.
5. Flag leads with missing email: suggest enrichLead for them.
6. Close with next steps such as "Draft outreach to the top 3" or "Enroll the A-grade leads in a sequence" (enrollInSequence, only after the user confirms).

Do not change any lead's status during triage unless the user asks.`,
});
