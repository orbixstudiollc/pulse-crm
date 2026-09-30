# Clay style for Pulse CRM

Reference: Clay web app (Mobbin, May 2026), 264 screens. Colours below were sampled from the full-resolution screenshots, not estimated.

## Decisions

- **Light is the default theme.** Clay is light-only. `app/layout.tsx` sets `defaultTheme="light"`; users can still pick Dark or System in Settings > Preferences, and dark tokens are retuned to stay coherent with the Clay look (neutral near-black, same blue).
- **Tokens, not per-page colours.** All colour changes go through `styles/globals.css`. Pages keep using token classes (`bg-surface`, `text-fg-secondary`, `border-line`, …); `scripts/restyle/scan.mjs` must keep passing.
- **Style, not structure.** Page layouts and features stay. The exceptions are the app shell (sidebar, header) and the Overview page, which adopts Clay's home pattern (greeting, ask box, quick-action cards).
- **Accessibility wins ties.** Clay's #0481F6 with white text is 3.7:1. Fills and borders use it; any blue that carries white text or sits as text on white uses the darker `accent-strong` so `scripts/restyle/contrast.mjs` passes at 4.5:1.

## Palette (light)

| Token | Value | Clay source |
|---|---|---|
| page, surface, background | #FFFFFF | page, sidebar, header, tables, modals |
| subtle | #F6F8FA | assistant panel, quick-action cards, row hover |
| muted | #F1F3F5 | pressed / selected rows, input fill when disabled |
| active | #EAEDF0 | active nav item, selected segment |
| sidebar | #FFFFFF | sidebar is white; separation comes from the hairline |
| line | #E6E8EB | inputs, cards, table outer borders |
| divider | #EFEFEF | table row dividers, sidebar edge, header bottom |
| row | #F1F1F1 | zebra / row separators where a slightly stronger line is needed |
| fg | #0C0E10 | headings, body, table cells |
| fg-secondary | #57585F | column headers, labels, secondary text |
| fg-muted | #7C7E80 | descriptions, placeholders, timestamps |
| fg-disabled | #B4B6B9 | disabled |
| accent | #0481F6 | primary button fill, focus ring, active tab outline, links |
| accent-strong | #0A6FD6 or the nearest blue that gives ≥4.5:1 with white | text-on-white links, buttons that must pass AA |
| accent-surface | #EAF4FE | selected pill, info banners |
| accent-on-surface | #0B63BF | text on accent-surface |
| success / success-fill / success-surface | #1E7A4F / #4EAA6B / #E7F6EC | Clay green toast #4EAA6B |
| warning / warning-surface | #8A5A00 / #FFF8D0 | Clay "Upgrade" pill |
| danger / danger-surface | #C02A26 / #FDECEC | unchanged hue |
| chart-grid / chart-axis | #EFEFEF / #7C7E80 | |

Dark: page #111214, surface #16171A, subtle #1B1C1F, muted #202226, active #26282C, line #2C2E33, divider #232529, fg #ECEDEE, fg-secondary #A1A3A8, fg-muted #7E8086, accent #3B9BFF, accent-strong #6FB5FF, accent-surface #0F2440. Must pass the same contrast checks.

## Type

- Inter (already loaded). Base 14px, line-height 20px.
- Page title (h1): 22px / 28px, weight 600, fg. Section title: 16px / 24px, weight 600.
- Card title: 15px weight 600 is Clay's size, but 15px is on the scanner's forbidden list, so use 14px weight 600.
- Table cells and nav labels: 14px regular. Column headers: 13px weight 500, fg-secondary.
- Descriptions / helper text: 13px, fg-muted. Badges: 12px weight 500.

## Shape, depth, density

- Radius: 6px controls (buttons, inputs, selects, segmented tabs, badges use full pill), 8px cards and menus, 10px modals. Tokens: `--radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-xl: 10px`.
- Borders: 1px hairline (`border-line` for controls/cards, `border-divider` for dividers). No 2px borders.
- Shadows: none on cards. Dropdowns/menus `0 4px 16px rgba(16,24,40,0.08), 0 0 0 1px var(--line)`; modals `0 12px 40px rgba(16,24,40,0.14)`.
- Heights: buttons and inputs 32px (h-8), large primary 36px; table rows 40px; header 56px; sidebar item 36px.
- Spacing: page padding 24px (px-6) desktop, 16px mobile; section gap 24px; card padding 16px.

## Components

- **Primary button**: accent fill (`bg-accent`), white text, 6px radius, h-8, px-3, 14px weight 500; hover `bg-accent-strong`. **Secondary**: white fill, `border-line`, fg text, hover `bg-subtle`. **Ghost**: no border, fg-secondary, hover `bg-subtle`.
- **Input / select / search**: white, 1px `border-line`, 6px radius, h-8, placeholder fg-muted, focus ring 2px accent at 30% plus accent border.
- **Segmented tabs** (Clay "All files | Recents | Favorites"): a row of bordered segments; the active one gets a 1px accent border and accent text on white; inactive fg-secondary.
- **Underline tabs** (settings-style pages): 14px, active fg with a 2px accent underline.
- **Card**: white, 1px `border-line`, 8px radius, no shadow. **Quick-action card** (Clay home): `bg-subtle`, no border, 8px radius, icon + 14px/600 title + 13px fg-muted description, hover `bg-muted`.
- **Table**: white, no outer card chrome beyond a hairline; header row 13px/500 fg-secondary with bottom `border-divider`; rows 40px with bottom `border-divider`; row hover `bg-subtle`; no zebra; first column may carry a leading icon; trailing actions are a 28px bordered "…" button.
- **Sidebar**: white, 1px right `border-divider`, 240px. Logo row 56px. Items: 16px icon + 14px label, fg, 36px tall, 6px radius, hover `bg-subtle`, active `bg-active` + weight 500. Group separators are hairlines, not headings. Settings and help live in a bottom group.
- **Header**: white, 56px, bottom `border-divider`. Left: breadcrumb (fg-secondary segments separated by "/", last segment fg weight 500). Right: icon buttons (ghost, 32px), then the user block: avatar 28px + two lines (name 13px/600 fg, workspace 12px fg-muted).
- **Badge / pill**: 12px/500, pill radius, tinted surface + matching text (success/warning/danger/accent/neutral-subtle).
- **Modal**: white, 10px radius, modal shadow, header 16px/600 with close icon, footer right-aligned Cancel (secondary) + primary.
- **Toast**: Clay uses a solid success-fill toast with white text; our Toast success variant uses `bg-success-fill` + white text; others keep surface + border.
- **Empty state**: centred illustration/icon in fg-muted, 16px/600 title, 13px fg-muted description, primary button.

## Overview (Clay home pattern)

1. Greeting: "Hey {first name}, ready to get started?" (22px/600). Guests: "Hey there, ready to get started?".
2. Ask box: a single-line input with a sparkle icon and a round accent send button, placeholder "Ask Pulse anything or describe what you'd like to do…"; submitting routes to `/dashboard/copilot?prompt=<text>`.
3. Quick-action cards (4, horizontal, wrap on mobile): Find leads → /dashboard/lead-finder, Import data → /dashboard/leads?import=1, Create a campaign → /dashboard/sequences, Start from template → /dashboard/templates.
4. Existing stat cards and widgets follow, restyled by tokens.
