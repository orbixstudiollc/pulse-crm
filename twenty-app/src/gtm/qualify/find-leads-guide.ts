// The "find leads" playbook, shared by the Twenty chat skill and the Pulse chat.

export const FIND_LEADS_GUIDE = `# Find leads

Goal: a fresh ICP built from the user's answers, then new leads found in Prospeo and run through qualification. Each run starts from scratch; do not reuse an earlier ICP unless the user asks to.

## 1. Interview (one message, then follow-ups only where an answer is missing or vague)
Ask these together, numbered, with an example answer for each:
1. Who are you selling to this time? What must the company do to fit, and who should be left out?
2. Which industries or company types?
3. Which job titles decide or sign? (e.g. Founder, CEO, Managing Director)
4. Where? Countries, states or cities.
5. Company size in employees? (e.g. 11-50)
6. How many leads? Prospeo returns 25 per page at 1 credit per page; up to 250 (10 pages) per run.

## 2. Confirm
Show a short summary: name, description, industries, titles, locations, sizes, and pages (with the credit cost). Ask "Go?" and wait for yes.

## 3. Run, after yes
1. start-icp with name, description, jobTitles, industries, locations, headcount. It turns every other ICP off. If it returns unknownSizes, say which sizes were not understood.
2. find-leads with icpProfileId from step 1 and pages. Report found, created, and skipped duplicates. If nextPage is set, say more are available.
3. qualify-leads once to start the first batch. It also runs by itself every 5 minutes until no Pending leads are left.

## 4. Report
Qualified, Review and Rejected so far; say that Review leads are in the Lead review list and Qualified leads can be enrolled from Setup (enroll-qualified, only after the user confirms the sequence).

If a tool returns ok false, show its error in one line and stop. Never invent leads or counts.`;
