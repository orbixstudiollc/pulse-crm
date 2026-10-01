# Pulse vs Instantly and ReachInbox: new plan and approach

Sources: a full read-only review of both apps on 2026-10-02 (`compete/instantly.md` and `compete/reachinbox.md` in the session scratchpad), compared with Pulse's current code. Both competitor accounts were empty trials, so campaign builders and inboxes were seen only as empty states and column headers.

## What they are, and what we are

| | Instantly | ReachInbox | Pulse today |
|---|---|---|---|
| Core | Cold-email sending at scale, with AI agents on top | Cold-email sending at scale, with a unified inbox | CRM (leads, customers, deals, proposals) plus outreach plus AI |
| AI | Copilot with agents, approvals, artifacts, memory and recurring tasks; an AI panel docked on every page | AI lead search, AI campaign from your website, AI reply tagging | Copilot (chat, memory, tasks, 4 action tools, settings placeholder), AI features spread across pages, an MCP server for outside AIs |
| Data | SuperSearch: AI search, 16 filters, buying signals | Lead Finder: 500M leads, AI search, lead match CSV | Lead Finder (Apify), ICP scoring |
| Sending | Accounts, warmup, health score, deliverability tests, done-for-you mailboxes | Accounts, warmup, pre-warmed mailboxes, inbox-placement tests | Sequences send via connected Gmail/Microsoft; no warmup or health |
| Inbox | Unibox with lead-status labels and folders | Onebox: Primary/Others, AI auto-tags, keyboard shortcuts | Inbox (multichannel), basic |
| CRM | Add-on: Kanban opportunities and a revenue goal (14-day trial) | None (HubSpot sync) | Full native CRM: the thing they bolt on |
| Visitors | No | Person-level resolution (US, credits) | Pixel with ISP-as-company (v2 planned) |
| Business model | Credits plus bundles | Credits plus plans per product | Free and open-access; shared AI budget |

**Positioning.** They are sending machines with a thin CRM bolted on. We are a CRM with outreach and AI built in. To make a better version, we shouldn't try to out-sell their mailbox infrastructure. Instead we make the AI the way you work across the whole CRM, and match their best workflow patterns where we already own the data.

## Patterns worth taking (ranked by value to us)

1. **Agentic Copilot with approval cards (Instantly).** Multi-step runs show visible steps ("Checked audience…", "Completed…"). Side effects pause on an **Approve / Deny** card with the raw payload under Details. Settings lists **always-allowed tools**. Outputs become **Artifacts** (saved, starred, reopenable).
2. **Structured memory (Instantly).** Business Details (website, description, offers with on/off, competitors), Customer Profiles (ICPs with toggles), Guidance (up to 10 rules), Saved memories (the AI remembers on request). We already have ICP, Competitors and a memory table; this unifies them.
3. **AI docked on every page (Instantly).** A right-hand panel with starter cards and chips specific to the page ("Find leads like these", "Summarize this deal").
4. **Getting Started checklist as Home (ReachInbox; Instantly's is also the agent task list).** Five steps with a progress bar, a live preview and one main button per step. Agent suggestions ("Review 10 recommended leads") appear in the same list with approve/reject.
5. **Unified inbox done right (ReachInbox Onebox).** Primary/Others split, AI auto-tags (Interested, Meeting booked, Not interested, Out of office…), custom views, split reading pane, keyboard shortcuts with a help dialog.
6. **Recurring tasks from the composer (Instantly).** A clock icon in the chat input turns a prompt into a scheduled task, with notifications.
7. **AI natural-language search plus signals (both).** "SaaS founders in UAE hiring SDRs" turns into filters. Signals cover funding, hiring, launches and intent.
8. **Show the price before the click (Instantly).** Every paid action shows its cost per row before it runs. We have budgets; we should show them.
9. **Consistent empty states and help (ReachInbox).** One template: a "How does this work?" pill, a headline, one main button, four benefits.
10. **Sales Agent / Reply Agent (Instantly).** An autopilot that recommends prospects (approval needed), writes and sends within limits, and has a reply agent that triages and drafts, with human handover rules.

Not worth copying now:
- **Selling mailboxes and warmup networks:** infrastructure and an abuse risk, not our edge.
- **Person-level visitor de-anonymisation:** US-only, legally sensitive, needs a data partner.
- **Credit purchase flows:** no billing yet.

## Where we can be better than both

- **CRM-native actions.** Their Copilot acts on outreach objects. Ours can act on leads, deals, proposals, calendar, competitors and ICP: one assistant for the whole revenue workflow.
- **Transparent approvals and audit.** Every AI action is logged against the record it touched, with undo where possible. They show a payload; we can show a diff ("Stage: Proposal → Negotiation").
- **Open interfaces.** An MCP server and API keys already exist, so outside AIs (Claude, ChatGPT) drive Pulse. They have closed agents.
- **Honest data.** Real email verification (planned), and visitor companies that never show ISPs (planned).

## The new plan (phases)

### Phase 1: Copilot 2.0 (biggest visible jump, builds on existing code)
- **Agent runtime:** multi-step tool use with streamed step traces; tools are CRM-wide (search, create, update, move stage, draft and schedule email, create task or event, enrich, score) and reuse MCP tool definitions.
- **Approval cards:** every write tool pauses on an Approve/Deny card that shows a field diff. "Always allow this tool" settings per workspace; read tools never ask.
- **Artifacts:** saved outputs (lead lists, email drafts, proposals, reports, charts) that can be starred, searched and reopened, and linked to records.
- **Memory 2.0:** tabs for Business (offers and competitors pulled from Competitors), Customer Profiles (pulled from ICP), Guidance (10 rules) and Saved memories. "Remember that…" saves from chat.
- **Recurring tasks:** a clock in the composer, run by the daily cron (Hobby limit), with in-app notifications.
- **Settings:** fills the current placeholder with model/provider status, always-allowed tools, notifications and usage against the shared AI budget.
- **Docked AI panel** on Leads, Deals, Customers, Inbox and Campaigns, with page-specific starter cards that open Copilot with the page's context.

### Phase 2: Home = command center
- A Getting Started checklist (connect a mailbox, import or find leads, set ICP, create a sequence, install the visitor script, verify emails) with progress and a live preview per step.
- Below it, a daily command center: replies needing action, tasks due, deals at risk, hot visitors, and agent suggestions to approve. The checklist hides once complete.

### Phase 3: Inbox → Onebox-class
- AI reply classification (Interested, Meeting request, Not interested, Out of office, Wrong person, Unsubscribe) runs on incoming replies and updates the lead/deal status.
- Primary/Others split, custom views, split pane, keyboard shortcuts with a help dialog.
- AI draft reply with tone options; the Copilot approval flow is used for sends.

### Phase 4: Data quality and signals (already planned)
- Email verification and Visitors v2 (`PLAN-verify-track.md`, ready to execute; migrations 039–041).
- AI natural-language search in Lead Finder that turns a sentence into filters.
- Signals from sources we can actually get (company hiring pages, news, funding via Apify actors) as Lead Finder filters.
- Cost shown before paid actions, using the shared budget meters.

### Phase 5: Agents
- **Sales Agent:** autopilot from an ICP. It recommends prospects for approval, writes the sequence and runs within sending limits.
- **Reply Agent:** triages and drafts replies, with handover rules.
- Built on the Phase 1 runtime and approvals.

### Cross-cutting (small, do alongside)
- A "How does this work?" pill and one empty-state template.
- Decide on the sidebar: hide or keep Marketing, Playbook and Proposals (still open).
- Integrations page: webhooks plus the existing API keys and MCP, documented.

## Recommended order and why

1. **Phase 1, Copilot 2.0.** It's the biggest difference users can see, it reuses the existing Copilot, MCP tools and shared AI budget, and agents (Phase 5) depend on it.
2. **Execute `PLAN-verify-track.md`.** It's already planned; you run migrations 039–041 and add the provider keys.
3. **Phase 2, Home.** Small, and it ties everything together for new users.
4. **Phase 3, Inbox.** High daily value.
5. **Phase 5, Agents.**

Each phase goes through the same pipeline as before: an adversarial plan (astra-fable-plan), cheap-model execution with checks, a security review, then a push with your go-ahead.

## Open decisions for you

1. Start with Copilot 2.0, or execute the verification and tracking plan first?
2. Docked AI panel on every page, or only on Leads, Deals and Inbox at first?
3. Should agents be allowed to send emails at all, or only draft them for approval? Drafting only is recommended until the inbox and deliverability are solid.
4. Sidebar: hide Marketing, Playbook and Proposals?
