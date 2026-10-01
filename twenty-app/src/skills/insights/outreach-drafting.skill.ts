import { defineSkill } from 'twenty-sdk/define';

import { SKILL_OUTREACH_DRAFTING_ID } from 'src/constants/insights-ids';

export default defineSkill({
  universalIdentifier: SKILL_OUTREACH_DRAFTING_ID,
  name: 'outreach-drafting',
  label: 'Outreach drafting',
  icon: 'IconMail',
  description: 'Write short, personalised first-touch and follow-up emails',
  content: `# Outreach drafting

Goal: an email the rep would send with light edits.

1. Read the person (name, jobTitle, company, aiSummary, leadSource) and their company. Check website visits for pages they viewed and any open opportunity.
2. Pick the angle: one specific reason this person, at this company, now (a visited page, their role, their ICP match). Never claim knowledge that is not in the records.
3. Write:
   - Subject: under 6 words, lower-case is fine, no clickbait.
   - Body: 50-90 words. One line of relevance, one line of value, one low-friction ask (a question or a 15-minute call).
   - No "I hope this finds you well", no buzzwords, no fake familiarity.
4. For follow-ups, add new value instead of "bumping"; keep it under 50 words.
5. Offer 1 alternative subject line.
6. Drafts are never sent by you. If the user wants the person in a cadence, offer enrollInSequence and wait for their yes.`,
});
