# Audit B: live Pulse CRM (https://pulse-crm-weld.vercel.app), 1440x900, dark theme, guest workspace

Read-only audit. Nothing was created, saved, sent or run, and no AI action was triggered.

Method: the pages were checked in my own browser tab. The first tab (tab-16) closed partway through, so the rest were done in tab-20. On each page and view I ran a DOM script that checks:
- horizontal scroll;
- `img.complete && naturalWidth`;
- large bordered and rounded boxes (leftover cards);
- text clipped without an ellipsis;
- content running off the right edge;
- the padding of the first table cell.

I also ran `performance.getEntriesByType('resource')` to find any 4xx/5xx responses, read the console errors, took screenshots and confirmed root causes in the source where they were easy to find.

Console: the only errors on every page were the ignored Supabase "Lock broken by another request" AbortErrors. No other JS errors appeared.
Network: one 4xx on the pages in scope, the proposal-detail 404 (first finding below). Everything else returned 200.

## Findings

Format: `SEVERITY | page/view | what is wrong | how to reproduce | suspected cause/file`

BLOCKER | /dashboard/proposals → row click / row menu "View" | Opening any proposal goes to the bare Next.js "404 This page could not be found" screen, with no app shell. The table rows are clickable and "View" is the first menu item, so every user hits it. The proposals list also prefetches the detail route and gets a 404 (`GET /dashboard/proposals/<id>?_rsc=… → 404`). | Proposals → click any row, or ⋯ → View | There is no `app/dashboard/proposals/[id]/page.tsx`, but `app/dashboard/proposals/client.tsx:449` and `:493` push `/dashboard/proposals/${id}`.

HIGH | /dashboard/icp/[id] (both seeded ICPs) | The Pain Points section shows rows of a bare ":" with "Severity: undefined/10". The Criteria section is empty (just the heading). Weight Distribution shows default weights (20/20/20/15/10/10) instead of the seeded ones. | ICP → View Details on "Enterprise SaaS" or "Growth-Stage Startup" | The seed shape in `lib/seed/generate.ts:220-228` (`pain_points: string[]`, `company_size`, `industry[]`, …, `weights.company_size`) does not match the ICPCriteria shape the UI reads (`p.name`/`p.severity`, `criteria.budget…`, `criteria.channel…`) in `app/dashboard/icp/[id]/client.tsx:690-731`.

HIGH | /dashboard/icp (list) | The Criteria column is blank for every profile: the cell renders an empty `<div class="space-y-2">`. | Open ICP | Same seed/criteria shape mismatch as above.

HIGH | /dashboard/templates, category tabs | Every category tab (Cold Outreach, Follow-Up, Nurture, Re-engagement, Meeting, General) shows "No templates in this category", although all 6 templates carry a category badge. This includes the "Re-engagement" template under the "Re-engagement" tab. | Templates → click any category tab | The seed categories ("Outreach", "Follow-up", "Proposal", "Re-engagement", "Scheduling", "Onboarding") are display labels, not the tab ids (`cold_outreach`, `re_engagement`, …). Seed: `lib/seed/generate.ts`. Filter: templates client.

HIGH | /dashboard/sequences, category tabs | The "Nurture" tab is empty, although "New Lead Welcome Series" shows a "Nurture" badge. "Enterprise Outreach" (category "Outreach") appears under no category tab. | Sequences → Nurture | `lib/seed/generate.ts:208-209` sets `category: "Nurture"` and `"Outreach"`. `app/dashboard/sequences/client.tsx:268` filters with `s.category === activeTab`, where the ids are `nurture`, `cold_outreach`, etc.

MEDIUM | /dashboard/playbook | The "Pricing" metric shows 0 and the Pricing tab is empty, yet 2 of the 6 objection cards carry a "Pricing" badge. The Implementation tab is also empty. | Playbook → look at the metric strip, then click Pricing | The seed categories "price" and "trust" (`lib/seed/generate.ts:118`, `:163`) are not valid ids. The badge falls back to `categoryConfig.pricing` (`app/dashboard/playbook/client.tsx:279`), but the count and filter use the raw value.

MEDIUM | /dashboard/competitors | The "Direct" metric is 0 and the Direct, Indirect and Aspirational tabs are all empty, while 2 cards are labelled "Direct Competitor". | Competitors → click Direct | Seed `category: "Direct Competitor"` / "Enterprise Competitor" / "Budget Competitor" (`lib/seed/generate.ts:176-200`) vs the tab ids direct/indirect/aspirational.

MEDIUM | /dashboard/competitors/[id] | The battle card shows different strengths and weaknesses from the list card for the same competitor. For RivalCRM Pro, the list shows "Strong brand recognition, Large partner ecosystem, Mobile app" and the detail shows "Market presence, Brand recognition". | Competitors → View Battle Card on RivalCRM Pro | The detail reads the battle-card JSON and the list reads the strengths/weaknesses columns.

MEDIUM | Header breadcrumb on detail pages (ICP, sequence, competitor) | The last breadcrumb segment is the raw record UUID instead of the record name. The first letter is also capitalised when it is a letter, e.g. "Ffb8cd74-c641-…". | Open any ICP, sequence or competitor detail page | `components/layout/Header.tsx:74` title-cases the URL segment.

MEDIUM | /dashboard/settings?tab=preferences | The Timezone select shows "pt", an invalid value injected as the first option. | Settings → Preferences | The DB default is `timezone TEXT DEFAULT 'pt'` (`supabase/migrations/001_initial_schema.sql:46`), and `app/dashboard/settings/client.tsx:745` also falls back to "pt".

MEDIUM | Lead Finder settings: /dashboard/lead-finder/settings vs /dashboard/settings?tab=lead-finder | The two screens show conflicting state for the same workspace:
- Lead Finder → Settings shows a "Missing required API keys" banner, "Apify Token: Missing" and default provider "Custom (from AI Assistant settings)".
- Settings → Lead Finder shows an Apify token already set (masked) and provider "OpenRouter (Cloud)".
- The two Agency Type option lists also differ.

That is two UIs for one config. | Compare both pages | There are two settings implementations: `app/dashboard/lead-finder/settings/page.tsx` and the Settings "lead-finder" tab.

MEDIUM | /dashboard/campaigns, Paused and Drafts tabs | The empty tab says "No campaigns yet" with a "Create Your First Campaign" CTA, although 2 campaigns exist under All. | Campaigns → Paused | The empty state is not aware of the active filter.

MEDIUM | /dashboard/lead-finder/overview and /costs | The metric strip sits flush against the underline tab bar, with a 0px gap: the tab bar bottom is at 172.8px and the first metric label top is also at 172.8px. | Lead Finder → Overview or Costs | The MetricStrip (`px-8 pb-6`) has no top padding after PageTabs in the Lead Finder layout.

MEDIUM | /dashboard/copilot → Settings view | The whole panel is greyed out, with "These settings are coming soon." It reads as unfinished to every user. | Copilot → Settings | The Copilot settings view is a placeholder.

MEDIUM | Modals: Website Visitors "Setup Website Tracking", Campaigns "Manage Tags", Inbox "No Email Accounts" | Escape does not close these modals, they have no `role="dialog"`/`aria-modal`, and the X close button has no aria-label. The template Preview (shared Modal) does close on Escape. | Website Visitors → Setup Tracking → press Esc; Campaigns → Tags → Esc; Inbox → Compose → Esc | Hand-rolled `fixed inset-0` overlays in `app/dashboard/website-visitors/client.tsx` and `app/dashboard/campaigns/client.tsx` (no Escape handler, no role) instead of `components/ui/Modal.tsx`.

MEDIUM | /dashboard/competitors/[id] | There is no right properties panel. The contract says detail pages carry a `w-[320px]` properties aside, and competitors are not among the recorded deviations. | Open a competitor | The layout omits the aside.

LOW | /dashboard/lead-finder/settings → AI Providers | In the "Default provider" select, the value "Custom (from AI Assistant settings)" runs under the chevron, so the closing ")" is hidden. The text is 234px wide in a 246px box with a 12px right padding. | Lead Finder → Settings | The select needs about 32px of right padding for the chevron.

LOW | /dashboard/lead-finder/settings → Agency Profile | Developer copy is shown to users: "A dedicated persistence API will be enabled in a follow-up migration." | Lead Finder → Settings → Agency Profile | Leftover implementation note.

LOW | /dashboard/lead-finder/overview | Two stacked empty states say the same thing: "No activity yet / Create your first campaign" and "Get started with Lead Finder / Create Campaign". | Lead Finder → Overview with no campaigns | Redundant empty state.

LOW | Lead Finder sub-pages | The header description appears on some tabs only ("All leads across campaigns" on All Leads, none on Overview, Campaigns or Costs), so the tab bar jumps vertically between tabs. | Switch Lead Finder tabs | The description varies per route.

LOW | /dashboard/lead-finder/campaigns/new | The hairline above the action row starts at the pane edge but stops at the form column (720px), so it looks cut off. The form column is 720px, while the contract says 560px. | Open New Campaign | `max-w-[720px]` wrapper with a `border-t` action row.

LOW | /dashboard/website-visitors → Tracking Scripts | The domain input placeholder "Enter your domain (e.g., example.com)" is truncated to "Enter your domain (e.g., exar…" in a 239px input. | Website Visitors → Tracking Scripts | Input too narrow for its placeholder.

LOW | /dashboard/campaigns, /dashboard/templates | Descriptions and subjects are truncated at fixed `max-w-[200px]`/`max-w-[250px]` even though their columns are 349px and 327px wide. For example, "Nurture sequence for new inbou…". | Campaigns or Templates list | Hard max-widths on cell text.

LOW | /dashboard/campaigns | The "Active Campaigns" metric renders 0 first and then updates to 2 a moment later. | Load Campaigns | Client-side metric computed after fetch.

LOW | Empty-state CTAs (Lead Finder Campaigns, Campaigns Paused/Accounts) | The CTA is a filled primary blue button. The contract empty state uses an outlined `h-8` button with a plus icon, as the Marketing and Website Visitors pages already do. | Open those empty tabs | Inconsistent EmptyState usage.

LOW | /dashboard/sequences/[id] → Settings | The Active Days pills are separate filled chips with gaps. The contract uses joined segments with an outline active state. | Sequence → Settings | Custom day picker.

LOW | /dashboard/inbox | Two stacked segment controls use different heights: 28px for channels, 32px for All/Unread/Starred. The refresh icon button has no aria-label. | Inbox → Email | Inconsistent control sizes and a missing label.

LOW | /dashboard/copilot | Three empty "New Chat" entries sit in the history. The six icon-only buttons in the history rail have no aria-label. | Open Copilot | Empty chats are persisted, and the icon buttons are unlabelled.

LOW | /dashboard/settings?tab=billing | Usage counts use Indian digit grouping ("20 / 1,00,000") on a US-dollar plan. The page also shows "Next billing: Oct 30, 2026" while saying billing is not connected. | Settings → Billing | `app/dashboard/settings/client.tsx:1198` hardcodes `toLocaleString("en-IN")`.

LOW | /dashboard/settings?tab=profile vs header | The header shows a stock photo avatar (`/images/avatars/user.jpg`) for "Guest", while the Profile page shows the empty placeholder avatar. | Compare the header and Settings → Profile | The header falls back to a static image.

LOW | /dashboard/settings?tab=profile, security, integrations | Visible "coming soon" copy: "Account deletion is coming soon", "Two-factor authentication is coming soon", and every integration marked "Coming soon". | Settings sections | Unfinished features.

LOW | /dashboard/settings?tab=lead-finder | The masked Apify token field is prefilled with a value that reveals the last 4 characters of a configured token, and it is shown to anonymous guest sessions. Probably a server or shared token, not a guest one. I did not inspect it further. | Settings → Lead Finder | `app/api/lead-finder/settings/route.ts:120` masks all but the last 4 characters.

LOW | /dashboard/playbook (expanded objection) | The "Feel-Felt-Found Response" label sits right under the row divider with no top padding. The response blocks are coloured, bordered callout boxes. | Playbook → expand any objection | Expanded body spacing.

LOW | /dashboard/automation (Settings → Automation) | The "Active 0" metric is coloured success green even at zero, and the subtitle repeats the title ("Automation Rules · …"). | Settings → Automation | Styling and copy.

LOW | Several pages | Nested interactive elements, `<a><button>`: ICP "View Details", Lead Finder "New Campaign" and "Create Campaign". | Inspect the DOM | Link wrapping a Button.

LOW | Proposals, Templates footers | Grammar: "Showing 1–1 of 1 proposals". | Proposals → Draft | Missing pluralisation.

LOW | App-wide | The document title is "Pulse CRM" on most pages but "Inbox | Pulse CRM" on Inbox. There is also no app-level `not-found.tsx`, so a bad URL falls to Next's bare black 404. | Visit any page, or a bad URL | Per-page metadata is missing, and only customers, leads and sales have `not-found.tsx`.

## Pages and views checked and fine

The items below showed no defects beyond those listed above. That means:
- no horizontal scroll;
- no broken images;
- no leftover boxed cards;
- the first table cell is at 32px and tables are edge to edge;
- menus open fully in view;
- no console errors other than the ignored lock errors.

**Lead Finder**
- The sub-navigation underline tabs (Overview, Campaigns, All Leads, Costs, Settings) all route, the active tab is marked, and browser back works.
- The Campaigns empty state is fine.
- All Leads: the search, the status and campaign selects, and the filter row all work.
- Costs: both tables are fine.
- The Actors settings table is fine.
- The Enrichment and Obsidian Sync settings tabs are fine.
- `/campaigns/new` step 1 renders correctly, and "Plan Campaign with AI" is correctly disabled while the form is empty.

**Website Visitors**
- Both tabs switch.
- The All Statuses dropdown opens, filters and closes on Escape.

**Campaigns**
- The All, Active, Paused, Drafts and Accounts tabs switch.
- Search filters the rows (2 → 1 → 2).
- The row ⋯ menu (Edit / Clone / Delete) opens fully visible at the right edge.
- The Manage Tags modal opens and closes with its X button.

**Sequences**
- The list table and the row menu (View Details / Clone / Performance / Delete) work.
- On the detail page, all 5 tabs render: Steps, Enrolled Leads, Activity (its segment filter works), Analytics and Settings. "Load Advanced Analytics" was not clicked. Activity takes about 2s to appear the first time.

**Templates**
- The list and the row menu work.
- The Preview modal opens and closes.

**Inbox**
- The All, Email, WhatsApp and LinkedIn channel switches and the All, Unread and Starred filters all change content.

**Proposals**
- The status tabs filter correctly: Draft 1, Sent 2, others empty.
- The row menu is fully visible.

**Playbook**
- The Competition, Timing, Authority and Need tabs filter correctly.
- An objection expands.

**Competitors**
- The list grid and card menus work.
- The detail page renders.

**Marketing**
- The Audits, Content, Reports and Action Plan tabs switch.
- `/marketing/new` renders, view only.

**Copilot**
- The empty state, Memory and Tasks views render. No message was sent and no prompt chips were clicked.

**Settings**
- The settings nav replaces the sidebar.
- All 13 sections switch in about 60ms.
- The URL updates to `?tab=`, the active item shows an edge bar, and browser back steps through the tabs.
- An unknown tab falls back to Profile.
- "Back to app" returns to /dashboard/overview with the normal sidebar.
- The Security, Notifications, Integrations, Email Accounts, WhatsApp, LinkedIn and AI Assistant sections have no layout defects.
