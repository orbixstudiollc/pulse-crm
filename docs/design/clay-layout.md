# Clay layout: structure, not just colour

`clay.md` set the palette and component skins. This file sets the page anatomy, which is what actually makes Clay look like Clay. It overrides `clay.md` wherever they disagree (in particular "style, not structure" no longer holds).

Measurements come from the Mobbin captures (1920px wide at about 1.33× device scale, so a capture pixel divided by 1.33 gives the CSS pixel). The reference screens are Home 27, Campaigns 165, Signals 164, Usage 203, Workbook 120 and Table 37.

## The five rules

1. **No boxes around content.** Tables, metrics, sections and forms sit directly on the white page. A bordered, rounded card is allowed only for quick-action tiles, modals, dropdowns, drawers, kanban cards and list items inside a picker. Separation comes from 1px `border-divider` hairlines and whitespace.
2. **Tables run edge to edge.** They span the full width of the content pane. Only horizontal hairlines are drawn: top, header bottom and every row bottom. The first cell is indented 32px so text lines up with the page title. There are no outer borders, rounded corners or zebra stripes.
3. **One gutter.** Every page block uses `px-8` (32px), or `px-4` below `sm`. The only exception is tables, which bleed to the edge and indent their first cell instead.
4. **The top bar spans the whole window**, with the logo on the left. The sidebar sits underneath it.
5. **Active state is a thin line, never a fill.** Sidebar: a 2px bar at the left edge. Page tabs: a 2px blue underline. Segments: a 1px blue outline.

## Shell

| Part | Recipe |
|---|---|
| Frame | `flex h-screen flex-col overflow-hidden bg-page` → `<Header/>` then `flex flex-1 overflow-hidden` → `<Sidebar/>` + content column (`flex flex-1 flex-col overflow-hidden`, banner slot, `<main className="flex-1 overflow-auto bg-page">`) |
| Top bar | `h-11 shrink-0 flex items-center border-b border-divider bg-surface`. The left zone is `w-[240px] px-6 max-lg:w-auto max-lg:px-4`: the mobile menu button plus the wordmark "Pulse" (`text-[18px] font-semibold text-fg`, links to /dashboard/overview). A breadcrumb follows **only on routes deeper than `/dashboard/<section>`**, and in Settings: segments `text-[14px] text-fg-secondary`, separator `CaretRightIcon size 12 text-fg-muted`, last segment `text-fg`. Right zone (`ml-auto flex items-center gap-1 pr-4`): page actions, or else SearchBar, Calendar and Notifications; then the user block (28px avatar with name `text-[13px] font-semibold` and workspace or email `text-[12px] text-fg-muted` on two lines). The header drops its Settings gear, since Settings lives in the sidebar. |
| Sidebar | `hidden lg:flex w-[240px] shrink-0 flex-col bg-surface border-r border-divider`. It has no logo row, because the logo is in the top bar. Groups are separated by full-width `border-t border-divider`, and each group is `py-2`. |
| Nav item | `relative flex h-9 items-center gap-2.5 px-6 text-[14px] text-fg hover:bg-subtle`, icon 16px `text-fg-muted`. Active: `font-medium`, icon `text-fg` with `weight="fill"`, plus a bar `<span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-fg" />`. There is no background fill and no rounded pill. |
| Bottom group | Pinned: `mt-auto border-t border-divider py-2` (Settings). |

## Page anatomy (list pages)

```
<Page>                                   min-h-full pb-10
  <PageHeader icon title description>    px-8 pt-7 pb-6, actions right
  <MetricStrip> <Metric/>… </MetricStrip> optional, px-8 pb-6
  <PageTabs/> or <SegmentedControl/>      optional
  <TableSection title actions>            heading row px-8 h-14, then .clay-table
  <TableFooter/>                          px-8 h-12
</Page>
```

- **PageHeader.** The left side is an optional icon tile (`flex h-9 w-9 items-center justify-center rounded-lg bg-subtle text-fg-secondary`, icon 18px) followed by the title `text-[20px] leading-7 font-semibold text-fg` and an optional description `text-[13px] text-fg-muted`. The right side holds the actions, `flex items-center gap-2`, in this order: search input (`w-48`), secondary (outlined) buttons, then **one** primary blue button last.
- **Metric** (replaces the StatCard tile): label `text-[13px] text-fg-muted`, value `mt-1 text-[18px] leading-6 font-semibold text-fg`, optional change line `text-[12px]` coloured by trend. **MetricStrip** is `flex flex-wrap gap-x-10 gap-y-4 px-8 pb-6`, with no borders or backgrounds.
- **PageTabs** (Clay "Sequences | Email accounts"): `flex items-end gap-6 px-8 border-b border-divider`. Each tab is `relative h-10 text-[14px] font-medium`, inactive `text-fg hover:text-fg-secondary`, active `text-accent-strong` with `<span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />`. An optional icon (16px) or count (`text-fg-muted`) goes inside the tab. When a table follows, its top hairline is dropped so the lines don't double up.
- **SegmentedControl** (Clay "All files | Recents | Favorites"): the joined group is `inline-flex`. Each segment is `h-8 px-4 text-[14px] text-fg border border-line -ml-px first:ml-0 first:rounded-l-md last:rounded-r-md hover:bg-subtle`, and the active segment is `relative z-10 rounded-md border-accent text-accent-strong`. Use it for view and filter switches. **Separate outlined pills with gaps are wrong.**
- **TableSection** heading row: `flex h-14 items-center justify-between gap-4 px-8`, title `text-[18px] leading-6 font-semibold`, actions on the right (search `w-48`, rows-per-page, "New" primary). The `.clay-table` sits directly under it.
- **Filter row** (optional, between the heading and the table): `flex h-10 items-center gap-2 px-8 border-t border-divider`, with small `h-7` outlined controls and a ghost "Filters" button.
- **`.clay-table`** (global CSS in `styles/globals.css`, unlayered so it wins over cell utilities):
  - Wrapper: `border-top: 1px solid divider; overflow-x: auto`.
  - `th`: height 36px; 13px/500; `fg-secondary`; no background; `border-bottom` divider; 12px side padding.
  - `td`: height 44px; `border-bottom` divider; 12px side padding.
  - First cell: `padding-left: 32px`. Last cell: `padding-right: 16px`.
  - Row hover: `bg-subtle`.
  - Leading icons in the name cell are 16px `text-fg-muted`. The row action is a 24px bordered square button (`h-6 w-6 rounded-md border border-line text-fg-secondary hover:bg-subtle`) holding a `DotsThree` icon.
- **TableFooter**: `flex h-12 items-center justify-between px-8 text-[13px] text-fg-muted`. It has no top border, because the last row already draws one.
- **EmptyState**: centred with `py-16`. It shows a 24px `text-fg-muted` icon, a title `text-[14px] font-medium text-fg`, a description `text-[13px] text-fg-muted`, and an outlined (secondary) `h-8` button with a plus icon. There is no box.

## Sections, detail pages, settings

- **Section** (replaces every boxed card on dashboards and detail pages): `px-8 py-6 border-t border-divider first:border-t-0`. The heading row is `flex items-center justify-between mb-4`. Title `text-[16px] leading-6 font-semibold text-fg` (optional 16px icon before it), description `text-[13px] text-fg-muted mt-0.5`. Content sits directly inside.
- **Detail page** (a lead, customer, deal, sequence, ICP, competitor or campaign record):
  - The record header is a PageHeader whose icon is the avatar or record icon. Under the title goes a meta line (status badge, owner, dates) as `text-[13px] text-fg-muted`.
  - Then a MetricStrip, then PageTabs.
  - Body: `flex max-lg:flex-col`, with a main column (`flex-1 min-w-0`) of Sections and tables and a right **properties panel** (`w-[320px] shrink-0 border-l border-divider max-lg:w-full max-lg:border-l-0 max-lg:border-t`).
  - Panel sections are `px-6 py-5 border-t border-divider first:border-t-0`. Each has a title `text-[13px] font-semibold text-fg` and key/value rows (`grid grid-cols-[120px_1fr] gap-y-2 text-[13px]`, keys `text-fg-muted`).
- **Forms** (add, edit, settings): fields sit directly on the page in a `max-w-[560px]` column. Groups are Sections, and each group's save button sits at the bottom right of its Section. There are no boxed field groups.
- **Settings**: as in Clay, the app sidebar switches to a settings nav while on `/dashboard/settings`.
  - The nav background is `bg-subtle`.
  - The top row is a back link ("← Back to app", `h-11 px-6 text-[14px] text-fg-secondary`) with a hairline under it.
  - Group labels are `px-6 pt-4 pb-1 text-[13px] text-fg-muted` ("Account" and "Workspace").
  - Items use the same nav-item recipe, linking to `?tab=<id>`, and the page reads its active tab from the URL.
  - Content column: `px-12 pt-8 pb-10 max-w-[880px]`, with the title `text-[20px] font-semibold` and Sections below it.
- **Quick-action tile** (Overview, Lead Finder hubs): `flex items-start gap-3 rounded-lg bg-subtle p-4 shadow-card hover:bg-muted`, about 230×84px. It holds a coloured 18px icon, a title `text-[14px] font-semibold text-fg` and a description `text-[13px] text-fg-muted`. `shadow-card` is a new utility (`0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.06)`, darker in `.dark`).
- **Charts**: they sit in a Section with no frame. Axis labels are 12px `fg-muted`, the grid is `chart-grid` with horizontal lines only, and bars have a 2px radius.
- **Kanban** (Sales pipeline): columns have no background box. Each column header is a label, count and value above a hairline. Deal cards remain small bordered cards (`rounded-lg border border-line bg-surface p-3`).
- **Drawers and modals**: the frame keeps `clay.md`. Their content follows the Section rules (hairline-separated groups, no nested boxes).

## Overview (Clay Home)

1. The greeting row: `px-8 pt-7`, h1 `text-[22px] font-semibold`, with an optional "Show less" outlined button on the right.
2. The ask box: `mt-5 w-full max-w-[660px] h-12 rounded-lg border border-line`, with a sparkle icon, a placeholder and a 28px round send button.
3. Quick-action tiles in `mt-8 flex flex-wrap gap-4`.
4. MetricStrip (Revenue, Active deals, Total leads, pipeline), `mt-8`.
5. A SegmentedControl, `mt-8 px-8`, with "Latest leads | Active deals | Activity | Revenue".
6. A TableSection whose title follows the segment ("Latest leads" and so on), with a search box and "New lead" on the right. Below it is a full-bleed `.clay-table`. The Revenue segment shows the chart in an unframed Section instead of a table.

## What executors must not do

- Change handlers, data fetching, props passed to children, conditions or copy. Layout JSX may be regrouped (wrappers removed, sections reordered), but every element that was there stays reachable.
- Introduce new colours or arbitrary hex values. Use tokens only; `scripts/restyle/scan.mjs` must pass.
- Leave a `rounded-lg border border-line` (or `rounded-xl border`) box around a table, metric group or section. Run `node scripts/restyle/boxes.mjs <files>` to list what remains.

## Execution record (2026-10-01)

- **Plans:** `tasks-clay2.json` covers the foundation and the pilot. `tasks-clay3.json` covers the rollout, and `tasks-clay4.json` the review fixes. All were run with astra-fable-execute, and every task passed its own gate before commit.
- **Foundation.** L1: the shell. L2: the page kit plus the `.clay-table` CSS. L3: the accessibility fixes from the colour review.
- **Pilot (P1, P2).** Overview, Leads and Sequences were built first. Each was compared against Clay screens 27, 164 and 165 before the rollout.
- **Rollout.**
  - L4: the row menu is portalled so tables can't clip it, it uses horizontal dots, and page tabs scroll.
  - L5: route loading skeletons.
  - R1–R14: every list page, detail page, form, Copilot, Settings (whose own nav replaces the sidebar) and the drawers.
  - F1: Settings sections switch with shallow URL updates.
  - F2: the Lead Finder sub-navigation became underline tabs.
- **Review (Opus).** No critical or high findings. The medium and low findings were fixed in V1–V5:
  - Customer bulk actions now act only on visible selected rows.
  - Copilot stacks on phones.
  - Page header actions wrap.
  - Customer records fall back to an initials avatar.
  - The Latest leads footer no longer paginates.
  - Unknown settings tabs fall back to Profile.
  - The row menu has ARIA attributes and closes on scroll.
- **Final gate (G2, re-run after V1–V5).** Lint, tests, production build, `scan.mjs`, `contrast.mjs` and `boxes.mjs` across every page all pass.
- **Intentional deviations, all recorded in the task reports:**
  - The ICP list dropped a duplicate eye-icon link to the detail page.
  - The competitor battle card is now stacked Sections instead of a two-column grid.
  - The Inbox and Copilot keep full-height workspaces instead of `<Page>`.
  - The sequence detail page and the Lead Finder campaign detail page have no properties aside, because they have no properties content.
