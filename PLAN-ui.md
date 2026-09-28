# PLAN-ui.md — Restyle Pulse CRM to the Devin web-app visual language

Produced by an adversarial two-planner debate (Astra: shipping speed, Fable: correctness) on 2026-09-28, two rounds; no round 3 was needed because the surviving disputes were settled by measurement or by the owner's stated assumptions. Debate artifacts: scratchpad `afp-pulse-ui/` (brief.md, r1-*.json, r2-*.json, ref/*.png). Executable task list: `tasks-ui.json` (14 tasks, run with `astra-fable-execute`). The earlier gap-closing plan (`PLAN.md`, `tasks.json`, commits e9c9691…91ea9a5) is untouched and its deferred items still stand.

## Reference, measured

250 screens of Devin web (Aug 2026) plus seven full-size samples. Devin is **light-first**: page `#fdfdfd`, sidebar `#f8f8f8`, active row `#e9e9e9`, hairline borders `#e7e7e7`/`#eeeeee`, text `#0f0f0f` / `#727272` / `#8a8a8a`, one accent `#317cff`, success `#288c5f` on `#dcf8e7`. Dark theme: page `#141414`, sidebar `#181818`, active `#252525`, lines `#1f1f1f`. Radii 6 px controls / 8 px panels / pills; no card shadows; 1 px borders; sidebar 260 px; header 48 px; content 1120 px; 14 px body, 13 px table cells, 20 px page titles, 22 px stat values. No Devin video was available, so motion is 150/200 ms ease-out with reduced-motion respected (A6).

## Approach

1. **Semantic, theme-flipping tokens** in `styles/globals.css` registered as Tailwind colours (`bg-surface`, `text-fg-secondary`, `border-line`, `bg-accent-strong`, `text-success`, chart-1…5, …) so a class is correct in both themes without a `dark:` pair. Inter via `next/font/google`; legacy `font-serif`/`font-onest` aliased to Inter during the sweep and removed at the end. Existing `.text-heading-*`/`.text-h*` utility names keep their names with the new scale, so 58 files restyle without edits.
2. **Accessible foreground roles** where the sampled pairs fail WCAG: `--accent-strong #2563eb` for button fills and links (white on it 5.17:1) while `#317cff` stays for decorative fills and charts; `--fg-secondary #6b6b6b` (4.72:1 on the muted surface); success/warning/danger text darkened to pass on their surfaces. A contrast script measures the fixed pair list in both themes and is a gate.
3. **A deterministic, unit-tested codemod** rewrites the class vocabulary (validated against the real tree: 11,487 mapped occurrences, every unmapped token either given a row or a hand-fix rule). Unknown tokens are never guessed: they are left untouched, reported, and caught by the scan. A scan enumerates forbidden families, non-approved neutral shades, hex over an explicit per-file allowlist, missing table scroll wrappers, and gradients. A JSX-text guard (document order, no de-dup) and a diff-line guard prove each swept file changed only presentation.
4. **Kit primitives and chrome by hand** to the measurements; **pages by codemod plus bounded hand-fixes**, batched by area and verified by scan + guards + tsc/lint/test; light/dark screenshots of the unauthenticated auth routes only (owner's decision: no login).

Commit order: tokens+fonts → tooling → kit A / kit B → chrome / dashboard primitives+charts → auth → components → CRM → outreach → intelligence → lead-finder → settings+stubs → final gate.

## Assumptions as applied (overrule before executing)

- **A1 Inter** applied; serif headings become 600-weight sans.
- **A2 Sidebar collapse removed.** Disputed: Astra held that the no-behaviour-change constraint protects the collapse control; Fable held that the owner's A2 governs and the control is icon-only, unpersisted, and adds no DOM text. Ruled for A2 as written. Open risk R1.
- **A3 Header** 48 px, sentence-case breadcrumb, 32 px controls; actions unchanged.
- **A4 amended:** toasts are bottom-centre but themed from next-themes `resolvedTheme` (a `ThemedToaster` in `components/features/ThemeProvider.tsx`), not Sonner's `system`, because the settings page lets the app theme diverge from the OS. Both sides converged.
- **A5** semantic colours adopted with the accessibility adjustments above; violet/lime scales deleted.
- **A6** motion defaults; no video.
- **A7** gated stub routes swept.
- **A8** no login; static verification + auth-route screenshots.
- **A9** chart colours via `lib/design-system/chart-colors.ts` CSS-variable constants.
- **Light-first ≠ forced light:** `defaultTheme="system"` is kept (disputed; Astra wanted `light`). Changing it alters behaviour for every user without a stored preference and breaks the colour-scheme-emulated dark screenshots that are the only dark evidence allowed. The light palette is the design target; the OS still picks the initial mode.
- **No org switcher, no "Recent", no bottom "Upgrade" row in the sidebar** (Fable's round-1 chrome had them; Astra showed they add a fetch, new DOM text and new actions). The existing wordmark stays.
- **StatCard keeps its `icon` prop** (30 call sites) but no longer renders it, matching the reference tile.
- **No `.crm-table` CSS primitive** (Astra): Tailwind v4 layers utilities, so an unlayered rule would silently override per-cell alignment/padding; tables are rewritten per cell instead.
- **ColorPicker palette moved to `lib/design-system/palette-data.ts`** so the kit has zero hex literals (Astra's position); the four remaining data-colour files carry hex allowlists equal to today's counts, not a loose budget.
- **Codemod safety rules from cross-examination:** a `dark:` token is deleted only when a light token with the same variant chain and property exists in the same string, otherwise kept and reported (521 dark-only hover/focus variants exist); every shadow utility is deleted rather than converted; `p-5`/`p-6` become `p-4` only in bordered+rounded strings; the codemod refuses paths outside `app/` and `components/`.
- **No control-type conversions:** a Checkbox never becomes a Switch (role and FormData contract).

## Where the planners disagreed and how it was ruled

| Dispute | Astra | Fable | Ruling |
|---|---|---|---|
| Migration mechanism | Hand-migrate, verified by a single flag-driven verifier | Unit-tested codemod + four small scripts with stated rules | Fable: the verifier's flags had no semantics a cheap executor could implement; the codemod's mapping was validated on real files. Astra's safety constraints folded in. |
| Dark-variant deletion | Never delete unmatched dark variants | Delete by property, report orphans | Astra's stricter rule (variant chain + property). |
| JSX-text guard | Sorted/deduped output hides reorders and drops | (r1) sorted+dedup | Astra: document order, no de-dup. |
| Sidebar collapse | Keep | Remove per A2 | A2 (owner's stated assumption), risk R1. |
| Default theme | `light` | keep `system` | Fable (no behaviour change; screenshots work). |
| Table styling | `.crm-table` primitive | per-cell rewrite | Fable (Tailwind v4 cascade layers). |
| Hex in kit | move data out, zero hex | per-file budget incl. ColorPicker | Astra (palette-data.ts; budgets pinned to current counts). |
| Card padding/shadows | finish in each batch | leave where codemod can't classify | Both: codemod handles the bordered+rounded case; sweeps finish the rest by hand. |
| Toaster theme | resolvedTheme | resolvedTheme | Converged. |
| Contrast | explicit accessible roles | measured values | Converged (Fable's measured values). |

## Open risks

- **R1 Sidebar collapse removal** is a visible capability change even though no DOM text changes. *Settle:* owner's call; the DOM-text guard passes either way, and restoring it is one commit (`Sidebar.tsx`, `SidebarContext`).
- **R2 Codemod leaves residues** in the 112 template-literal `className` sites and 17 orphan-dark strings; each sweep must hand-fix its scan report, and a residue that the scan cannot express (padding on non-bordered blocks, popover shadows) is only caught by the reviewer. *Settle:* judgment review over `git diff 91ea9a5..HEAD` after execution.
- **R3 Contrast rounding edge:** info/primary badge text on the accent surface measures 4.49:1 in light. *Settle:* `contrast.mjs` output; darken `--accent-on-surface` by one step if it fails.
- **R4 1120 px content column** may cramp the widest tables (lead-finder leads list, campaign detail, sequences). *Mitigation:* the scan's TABLE_SCROLL rule forces `overflow-x-auto` wrappers; no column changes.
- **R5 Authenticated pages are never rendered** during verification (A8). Static gates prove class vocabulary and text preservation, not layout. *Settle:* owner opens `/dashboard/overview`, `/leads`, `/settings`, `/sequences/[id]`, `/lead-finder/campaigns` in both themes after the run.
- **R6 Sonner theming** relies on `resolvedTheme` being defined on first render; SSR renders `undefined` → light toast briefly possible on a dark first paint. *Mitigation:* ThemedToaster renders nothing until mounted.
- **R7 `p-6 → p-4` heuristic** in bordered strings may also shrink padding on bordered section wrappers that are not cards. *Settle:* judgment review; revert per site.
- **R8 Parallel executors** on disjoint file sets commit sequentially in the gate with `git add -- <declared files>`; a file touched outside a task's declared list is not committed by that task and surfaces in the scope gate.

## Rejected alternatives

- Redefine Tailwind's neutral scale to the sampled greys so 9,400 classes restyle with no edits: leaves 5,600 `dark:` pairs, cannot express theme-flipping semantics, cannot meet the ≤5-shades rule.
- Add backward-compatible props or a second theme layer: violates "tokens first".
- Org switcher / Recent list / Upgrade row in the sidebar: new fetch, new text, new actions.
- `defaultTheme="light"`: behaviour change and breaks dark evidence.
- `.crm-table` CSS primitive: cascade-layer override of per-cell utilities.
- One opaque verifier with feature flags: unimplementable by a cheap executor.
- Regex-rewrite of the 58 serif callers inside the tokens commit: untested rewrite before the codemod exists; aliasing is additive.
- Authenticated screenshots or visual-regression tooling: forbidden by A8 / out of scope.
- Converting checkboxes to switches: DOM/role contract change.
- Keeping `#317cff` for button labels at 3.85:1: fails the hard contrast floor.

## Execution record (2026-09-28)

Executed with `astra-fable-execute`: 15 tasks (14 planned + T2b tooling amendment) in 6 waves, Opus executors, each task gated by its own verify. Pre-run snapshot ref: `refs/backups/pre-ui-20260928` (= `91ea9a5`). Diff snapshot to HEAD: 183 files, +6838/-5689. Scope drift against declared file lists: none.

| # | Commit | Task |
|---|---|---|
| 1 | `d3e9847` style(tokens) | T1 semantic tokens (light/dark), Inter, radius cap, type utilities, reduced motion |
| 2 | `467e2ea` chore(restyle) | T2 codemod (validated on the real tree: 13,321 tokens rewritten, idempotent, JSX text unchanged), scan, contrast, jsxtext, diffguard, 143 tests |
| 3 | `cf3146f` style(kit) | T3 form controls and buttons; ColorPicker palette moved to `lib/design-system/palette-data.ts` |
| 4 | `215ee76` style(kit) | T4 Card, Badge, Tabs, Modal (480/8/1), Drawer, menus, Toast, confirm dialogs |
| 5 | `2521781` style(chrome) | T5 260 px sidebar (collapse removed per A2), 48 px header (sentence case), 1120 px column, ThemedToaster |
| 6 | `4968012` style(dashboard) | T6 PageHeader, StatCard, FilterBar, tables per cell, EmptyState, chart-colors helper, RevenueChart |
| 7 | `fb5cb57` chore(restyle) | T2b diffguard accepts chart colour-map / style-object edits; scan TABLE_SCROLL lookback 30 + `overflow-visible` opt-out |
| 8 | `f2202ac` style(auth) | T7 six auth pages |
| 9 | `51392a9` style(components) | T8 41 feature/automation/lead-finder/postpeer components |
| 10 | `35f4cb7` style(crm) | T9 overview, customers, leads, contacts, sales |
| 11 | `680f248` style(outreach) | T10 campaigns, sequences, inbox, templates, marketing, proposals, playbook |
| 12 | `39f006a` style(intel) | T11 analytics, icp, competitors, website-visitors, activity, calendar, copilot, lead-scraper |
| 13 | `4246bc4` style(lead-finder) | T12 lead-finder pages |
| 14 | `fc12aa3` style(settings) | T13 settings, error states, gated stub routes |
| 15 | `3461a44` fix(restyle) | T15 judgment-review fixes (HIGH 1-4, MEDIUM 5-8; see below) |
| 16 | (this commit) docs | T14 final gate, font aliases and unused colour scales dropped from globals.css, this record |

**Final gates on HEAD:** `node scripts/restyle/scan.mjs app components` = scan ok (221 files); `node scripts/restyle/contrast.mjs` = contrast ok (36 pairs); `npx tsc --noEmit` 0 errors; `npm run lint` 0 errors (173 pre-existing warnings); `npm test` 167/167; `npm run build` run by T14. Residual literals: `indigo-*` 0, `font-serif`/`font-onest` 0, `dark:` colour tokens 0, `shadow-(lg|xl|2xl)` 0, `neutral-*` 1 (`app/dashboard/sequences/[id]/client.tsx:1598`, scan-approved shade), `rounded-2xl` 5 (analytics x4, copilot x1; the radius cap renders them at 8 px).

### Token table (styles/globals.css)
Light/dark: `--page` #fdfdfd/#141414 (:13/:126), `--surface` #ffffff/#181818, `--subtle` #f8f8f8/#181818, `--muted` #f0f0f0/#1f1f1f, `--active` #e9e9e9/#252525, `--sidebar` #f8f8f8/#181818, `--inverse` #363636/#ededed, `--line` #e7e7e7/#1f1f1f, `--divider` #eeeeee/#1f1f1f, `--row` #f0f0f0/#1f1f1f, `--fg` #0f0f0f/#ededed, `--fg-secondary` #6b6b6b/#8a8a8a (:30/:141), `--fg-muted` #8a8a8a/#7a7a7a, `--accent` #317cff (:35/:145, decorative), `--accent-strong` #2563eb/#6da2ff (:36, buttons and links), `--accent-on-surface` #2360e6/#9dc0ff, `--success` #1e7a4f/#4ade80, `--warning` #946014/#fbbf24, `--danger` #c02a26/#f87171, chart-1..5, `--radius` 6px / `--radius-lg` 8px / `--radius-2xl` 8px, `--shadow-dropdown` (:118), `--shadow-modal`. Deviations from the sampled reference, all for WCAG: #727272 to #6b6b6b (4.22 to 4.68:1 on muted), #317cff to #2563eb for text/fills (3.85 to 5.17:1), #288c5f to #1e7a4f (3.72 to 4.71:1), danger #d0312d to #c02a26, `--accent-on-surface` #2563eb to #2360e6 (4.49 to 4.69:1, risk R3 closed).

### Measured contrast (scripts/restyle/contrast.mjs)
| theme | fg | bg | fg hex | bg hex | ratio |
|---|---|---|---|---|---|
| light | on-inverse | accent-strong | #ffffff | #2563eb | 5.17:1 |
| light | accent-strong | page | #2563eb | #fdfdfd | 5.08:1 |
| light | accent-on-surface | accent-surface | #2360e6 | #eaeffb | 4.69:1 |
| light | fg-secondary | muted | #6b6b6b | #f0f0f0 | 4.68:1 |
| light | success | success-surface | #1e7a4f | #dcf8e7 | 4.71:1 |
| light | warning | warning-surface | #946014 | #fdf3dc | 4.83:1 |
| light | danger | danger-surface | #c02a26 | #fde8e8 | 4.97:1 |
| light | fg-muted (3:1 floor) | page | #8a8a8a | #fdfdfd | 3.39:1 |
| dark | on-inverse | accent-strong | #0f0f0f | #6da2ff | 7.54:1 |
| dark | accent-strong | page | #6da2ff | #141414 | 7.25:1 |
| dark | fg-secondary | muted | #8a8a8a | #1f1f1f | 4.77:1 |
| dark | success / warning / danger on surfaces | | | | 7.72 / 8.30 / 5.93:1 |
All 36 pairs pass; full table in the scratchpad `afp-pulse-ui/contrast.txt`.

### Measurement checklist (file:line)
- Sidebar 260 px: `components/layout/Sidebar.tsx:101` (desktop) and `:150` (mobile drawer); nav items h-8, 16 px icons; no collapse.
- Header 48 px, sentence-case breadcrumb, 32 px controls: `components/layout/Header.tsx:22`.
- Content column 1120 px: `app/dashboard/layout.tsx:47`; ThemedToaster bottom-centre: `components/features/ThemeProvider.tsx:19`.
- Page title 20 px/600: `components/dashboard/PageHeader.tsx:11`. Stat tile 22 px/600 over 12 px label: `components/dashboard/StatCard.tsx:37`.
- Table header on `--muted`, 13 px cells, 8x12 padding, 1 px row lines: `components/dashboard/CustomersTable.tsx:175`.
- Tabs pill segmented control: `components/ui/Tabs.tsx:64`. Badge 12 px tinted pill, no dot by default: `components/ui/Badge.tsx`.
- Modal 480 px / 8 px radius / 1 px border: `components/ui/Modal.tsx:62`. Drawer: `components/ui/Drawer.tsx:69`. FormRow: `components/ui/FormSection.tsx:39`. EmptyState centred with outline actions: `components/dashboard/EmptyState.tsx`.
- Radii: `--radius` 6 px controls, 8 px panels (globals.css). Shadows: only `shadow-dropdown` (popovers) and `shadow-modal`. Motion: 150 ms colour, 200 ms overlays, reduced-motion honoured.

### Screenshots and evidence (A8, no login; owner directed the in-app browser)
`afp-pulse-ui/shots/README.txt` records, per route and theme, html class, computed body background and the focus ring: login-light rgb(253, 253, 253) with a 2px accent focus ring on keyboard focus; login-dark rgb(20, 20, 20) with the primary button rendering #6da2ff fill and #0f0f0f text (on-inverse flip); signup-light / signup-dark and forgot-light / forgot-dark likewise. `login-light.png` saved. Authenticated pages were not rendered (A8).

### Assumptions as applied and deviations
- A1 Inter; A2 collapse removed; A3 header; A4 amended to ThemedToaster on `resolvedTheme`; A5 semantic colours with WCAG adjustments; A6 motion defaults; A7 stubs swept; A8 static + auth-route evidence; A9 chart-colors helper. `defaultTheme="system"` kept. StatCard `icon` accepted, not rendered. Secondary Button is now a dark-filled emphasis tier (26 call sites; outline has 132).
- Executor deviations accepted: Modal/ConfirmDialog keep the `scale` entry (diffguard) with a 200 ms tween; Drawer close stays a native button; ConfirmDialog keeps its own dialog element (Enter-to-confirm) styled like Modal; Cancel buttons use `variant="ghost" className="shrink-0"` on one line; spans styled as Badge where a tag swap would fail diffguard; `<tr>` carries the header background where `<thead>` has no className; RevenueChart `animationDuration` stays 1200 (diffguard); ScoreHistoryChart uses 200; three multi-series charts use chartWarning for a third series; Switch/Toggle thumb is `bg-surface`; hand-rolled modals carry `shadow-modal`; the sidebar text guard accepts exactly the three removed collapse strings ("P", "Collapse sidebar", "Expand sidebar"); TABLE_SCROLL lookback 30 (a wrapper 29 lines above `campaigns/client.tsx:730`); `campaigns/client.tsx:828` keeps `overflow-visible` intentionally (row menu).
- Plan defects fixed during execution: contrast R3 (`--accent-on-surface`), rule (h) `text-white` to `text-on-inverse` on filled backgrounds (dark theme would be 2.54:1 otherwise), `index.ts` to `index.tsx`, diffguard/scan amendments (T2b).

### Judgment review (Opus, read-only, d3e9847..fc12aa3) and fixes (T15, `3461a44`)

Reviewer checks that found nothing: contradictory class pairs in one literal, `cn()`/twMerge dropping `text-heading-*` next to a colour, unknown colour tokens, unintended non-literal token edits, palette-data values (identical to the old ColorPicker list), popover shadows. Verdict before fixes: "do not push yet"; four HIGH, five MEDIUM, a LOW list. Overall coherence: reads as one design; light mode close to the reference; the weak spots are all dark mode, which the static gates cannot see.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | HIGH | `app/dashboard/layout.tsx` 1120 px wrapper had no height, so inbox (`flex h-full`) and settings lost pane scrolling | Fixed: wrapper `mx-auto h-full w-full max-w-[1120px] has-[[data-full-bleed]]:max-w-none`; inbox and sales roots carry `data-full-bleed` and opt out of the cap |
| 2 | HIGH | `sales/client.tsx` column counts `text-white` on theme-flipping fills (1.7 to 2.8:1 dark); discovery and negotiation both `bg-accent-strong` | Fixed: `text-on-inverse`; negotiation `bg-inverse` |
| 3 | HIGH | `analytics/client.tsx:631` built `"var(--chart-1)" + "1a"`, invalid CSS, stage pills lost their tint | Fixed: `color-mix(in srgb, <token> 10%, transparent)` |
| 4 | HIGH | `lead-finder/campaigns/[id]/page.tsx:682,685` secondary (inverse) buttons with `text-fg-secondary` override: 2.3:1 light, 2.9:1 dark | Fixed: `variant="ghost"` |
| 5 | MEDIUM | Mobile sidebar drawer had no in-drawer close after the collapse button was removed | Fixed: X button (`aria-label="Close menu"`) calling `closeMobile` |
| 6 | MEDIUM | Switch/Toggle knobs `bg-surface` (#181818) on off-track `bg-active` (#252525), about 1.1:1 in dark; same in three hand-rolled toggles | Fixed: off-state track `bg-fg-muted` / `var(--fg-muted)` in Switch, Toggle, sequences StatusToggle, lead-finder lead page, LeadDetailDrawer |
| 7 | MEDIUM | `(auth)/onboarding/page.tsx:47,49` step numbers `text-white` on `bg-accent-strong` (2.5:1 dark) | Fixed: `text-on-inverse` |
| 8 | MEDIUM | 1120 px column cramps the five-column sales kanban (needs about 1760 px) | Fixed by the `data-full-bleed` opt-out on the sales root |
| 9 | MEDIUM | 34 no-op hovers such as `bg-inverse hover:bg-inverse` (campaigns 10, lead-scraper 7, copilot 5, others) | Deferred, owner decision on hover treatment (`hover:opacity-90` suggested) |
| 10 | LOW | Sentence-case header renders "Icp" and "Website-visitors"; `uppercase` removal exposes raw enum values (inbox provider, campaign schedule_frequency) | Deferred: add `segmentLabels` entries; format the two enum strings |
| 11 | LOW | Series collapsed to 5 chart colours: 6th pie slice repeats slice 1; sequence funnel shares colours (Sent/Clicked, Opened/Replied); calendar platform chips in three looks | Deferred |
| 12 | LOW | `font-medium font-semibold` pairs left by the `font-serif` mapping (sequences x6, templates x1); Toast success/error differ only by icon; ThemedToaster `toastOptions.className` overridden by Sonner CSS; `FormRow` unused; copilot `h-[calc(100vh-64px)]` leaves 16 px under the 48 px header; expanded AI chat sits under bottom-centre toasts at about 1280 px | Deferred |

Owner decisions the reviewer raised: (a) all 26 secondary (`bg-inverse`) buttons, mostly "Cancel", now read heavier than the primary beside them, inverting the dialog hierarchy; switching Cancel to `outline` is a one-line change per site. (b) In dark mode `--surface`, `--subtle` and `--sidebar` are all #181818 and `--line`, `--divider`, `--row`, `--muted` are all #1f1f1f, so card and input edges sit at about 1.1:1; lifting `--line` to about #2a2a2a in dark would separate them without touching any component. Charts: `var()` inside Recharts SVG presentation attributes resolves in current Chromium, Firefox and Safari; gradients kept `stopOpacity`.

### Deferred / follow-ups
- Authenticated pages need a human pass in both themes: `/dashboard/overview`, `/leads`, `/sales`, `/settings`, `/sequences/[id]`, `/lead-finder/campaigns` (risk R5).
- The auth hero still shows the pre-restyle dashboard preview PNGs (`public/images/auth/*-preview-*.png`); replace with new captures.
- 173 lint warnings (unused vars, `<img>`, hook deps) untouched.
- Judgment-review items 9-12 above (no-op hovers, header labels and raw enum strings, chart series colours, font-weight pairs, toast/AI-chat overlap, copilot height, unused FormRow) and the two owner decisions (Cancel as outline; dark `--line` lift).
- The earlier gap plan's deferred items in `PLAN.md` still stand.
