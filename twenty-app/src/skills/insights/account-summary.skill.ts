import { defineSkill } from 'twenty-sdk/define';

import { SKILL_ACCOUNT_SUMMARY_ID } from 'src/constants/insights-ids';

export default defineSkill({
  universalIdentifier: SKILL_ACCOUNT_SUMMARY_ID,
  name: 'account-summary',
  label: 'Account summary',
  icon: 'IconBuilding',
  description: 'Summarise a company: people, deals, activity, fit and risks',
  content: `# Account summary

Goal: everything a rep needs about one company in under a minute of reading.

1. Find the company by name or domain. If several match, ask which one.
2. Gather: the company record; its people (with leadStatus, icpGrade, leadScore, jobTitle); its opportunities (stage, amount, closeDate); recent notes, tasks and emails if available; website visits whose companyDomain matches the company's domain or whose person works there.
3. Write the summary in this shape:
   - **Snapshot**: what they do, size, location (only facts from the records).
   - **Fit**: best ICP grade among their people and why.
   - **People**: up to 5 key contacts, decision makers first.
   - **Pipeline**: open deals with stage, amount and close date; anything overdue.
   - **Signals**: recent visits, replies, meetings.
   - **Risks / gaps**: no champion, stale deal, missing contact data (suggest enrichLead).
4. End with 2-3 next steps.

Never invent facts. If something is unknown, say "not in the CRM".`,
});
