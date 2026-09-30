# Pulse CRM engineering audit (read-only), 2026-10-01

Repo HEAD `bdf3119` (main = origin/main). Live: https://pulse-crm-weld.vercel.app. Nothing was edited or committed, and nothing was written to the DB directly. One side effect: see the note under Guest workspaces.

Format: `SEVERITY | area | finding | evidence | suggested fix`

## Findings

HIGH | CI / background jobs | The lead-finder-worker step in the GitHub cron workflow never authenticates. A missing space makes curl read `300-H` as the timeout, treat the `Authorization: Bearer ...` string as a URL, and call the worker with no auth header, so it gets a 401. The whole job is then marked failed. | `.github/workflows/lead-finder-cron.yml:45` `curl -fsS --max-time 300-H "Authorization: ..."`. Introduced in `0d7a6a6` (2026-09-30 22:56 +0600), which changed `65 -H` to `300-H`. Reproduced locally: curl says "URL rejected: Malformed input" for the header string. | Change it to `--max-time 300 -H`. Add `actionlint` or a `bash -n`/shellcheck step to CI.

HIGH | CI / background jobs | The GitHub Actions `*/5` schedule barely fires. There has been 1 scheduled run in total (2026-09-30 16:23Z) and none in the ~3.7 h since. So the Lead Finder scheduler and worker, the automation executor and the sequence executor (B8 from the 09-30 audit) are effectively not running. | `gh run list --workflow=lead-finder-cron.yml`: 4 runs ever (3 workflow_dispatch, 1 schedule). Checked at 20:05Z. | Don't rely on GitHub schedules for 5-minute jobs. Use an external scheduler (for example Upstash QStash or cron-job.org) that calls the same routes with `CRON_SECRET`, or Vercel Pro crons. Add an alert on how long ago the last run happened.

MEDIUM | Open access / cost | Any cookie-less GET or HEAD to `/`, `/dashboard/*` or the auth pages from a non-bot user agent creates an anonymous auth user AND a seeded demo workspace (~110 rows). curl, uptime monitors and link checkers all qualify, because the bot regex doesn't match them. | `lib/supabase/middleware.ts:95-113` (no method or Accept check); `lib/auth/open-access.ts` `BOT_UA_RE`. This audit's 3 `curl -sI` calls created 3 seeded guest orgs at 20:03:50, 20:03:51 and 20:03:53Z. | Only provision on `GET` with `Sec-Fetch-Mode: navigate` / `Accept: text/html`, and never on HEAD. Consider provisioning lazily on first client load.

MEDIUM | DB / repo parity | The 13 hand-made tables are still not defined in any migration, so a fresh DB still can't be built from the repo. The planned "migration 033" slot is now taken by `033_custom_ai_provider.sql`. The cross-tenant check (whether a signed-in guest can read another org's rows) is still not done. | `comm` of `types/database.ts` tables vs `CREATE TABLE` in `supabase/migrations/*.sql`: apify_scraper_runs, campaign_tags, copilot_conversations, copilot_memory, copilot_messages, copilot_tasks, lead_searches, scraped_leads, sequence_email_accounts, sequence_tags, tracking_scripts, website_visitors, website_visits. | Run the pg_policies query from AUDIT-2026-09-30 §6 in the SQL editor, then capture the DDL and policies as `034_handmade_tables.sql`.

MEDIUM | Config | `.env.example` is not in git. `.gitignore` has `.env*`, which also ignores it, so the documented env list exists only on this machine. It also omits the mode switch and guest knobs. | `git check-ignore -v .env.example` gives `.gitignore:34:.env*`; `git ls-files .env.example` is empty. Read in code but missing from `.env.example`: `NEXT_PUBLIC_OPEN_ACCESS`, `GUEST_SIGNUPS_PER_HOUR`, `GUEST_RETENTION_DAYS`, `GUEST_SEED_DEMO_DATA`, plus legacy `APIFY_TOKEN` and `APIFY_API_KEY`. | Add `!.env.example` to `.gitignore`, document the 4 missing names, and commit it.

MEDIUM | Live headers | The CSP is only `frame-ancestors 'none'`. There is no `default-src`, `script-src`, `object-src` or `base-uri`, so it gives no XSS mitigation. | `curl -sI /` and `/dashboard/overview` show `Content-Security-Policy: frame-ancestors 'none'`; `next.config.ts` headers(). | Add a nonce-based CSP (Next proxy/middleware nonce). Ship it as Report-Only first.

MEDIUM | Public API (still open from 09-30) | One shared `PULSE_CRM_API_KEY` plus a caller-chosen `x-organization-id` on the service role, so the key holder can read every tenant. The key is set in production, so this API is live. | `lib/api-auth.ts:28-61`. `/api/public/leads` answers 401 "invalid credentials", not 503 "not configured". | Per-organization hashed keys (`public_api_keys` table), or unset the key until that exists.

LOW | Migrations | 032 (avatar storage policies) cannot be verified through PostgREST, because `storage.objects` policies are not exposed. Applied status is UNKNOWN. | `supabase/migrations/032_avatar_storage.sql` only touches `storage.objects` policies. | In the SQL editor: `select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'avatars_%';` should return avatars_insert_own, avatars_update_own and avatars_delete_own.

LOW | Guest cleanup (owner item) | The policy is now implemented: 7-day retention (`GUEST_RETENTION_DAYS`), purged by the daily-reset cron at 00:00 UTC, at most 1,000 per run. Nothing is old enough to purge yet (oldest guest is 2026-09-28T21:27Z), so it's unproven in production. Growth is ~88 guests/day, so the steady state is ~600 workspaces and ~65k rows. | `lib/auth/guest-cleanup.ts`, `app/api/cron/daily-reset/route.ts:62-66`. DB: 116 anonymous users = 116 guest profiles, 0 orphan anonymous users, 0 guests older than 7 days. | Check the daily-reset logs on 2026-10-06 for `guest cleanup: ... deletedOrgs>0`. Confirm 7 days is the retention you want.

LOW | Dead code (owner item) | `components/features/CreateInvoiceModal.tsx` is still present and unused. | The file exists (4,261 B). There are 0 references in app/components/lib/hooks, and no barrel `index.ts`. | Delete it.

LOW | Config (owner item) | `ANTHROPIC_API_KEY` is intentionally unset in production. Not verifiable within the allowed read-only commands: the env-status route needs auth, and `vercel env ls` wasn't run. The name IS set in local `.env.local`. The code now shows a clear "No AI API key configured" error. | `app/api/ai/chat/route.ts:67`, `lib/ai/client.ts:300`. | Keep it unset until there's a per-IP limit and a global spend cap (09-30 §3). Optionally confirm with `vercel env ls production`.

LOW | Framework | `middleware.ts` is deprecated in Next 16 (renamed to `proxy.ts`, and the `middleware` export is renamed too). | `node_modules/next/dist/docs/01-app/...`: "The `middleware` filename is deprecated, and has been renamed to `proxy`". | `npx @next/codemod@canary middleware-to-proxy .`

LOW | Lint | 0 errors, 162 warnings: 141 no-unused-vars, 11 no-img-element, 6 react-hooks/exhaustive-deps, 2 no-location-assign-relative-destination. | `npm run lint` | Clean up the 6 exhaustive-deps warnings first (possible stale closures), then the unused vars.

LOW | Logging | There are 4 `console.log` calls in app/lib/components. All are operational server logs (daily-reset guest-cleanup summary, the lf-worker stale-job recovery, the adaptive concurrency cap, and the dev-only pump). | `app/api/cron/daily-reset/route.ts:64`; `lib/lead-finder/enrichment/worker.ts:150,679,799` | Switch to `console.info` or a logger, to match the "no console.log" rule. No functional issue.

LOW | TODO/FIXME | 6 TODOs in files changed in the last 3 days (189 commits, 450 files), all in the hidden social routes. | `app/calendar/client.tsx:104,207,213`; `app/drafts/client.tsx:105,111,117` | Leave them while the routes are gated, or delete the routes.

LOW | Migrations | The two `20260313_*` migrations still share a version prefix (still open from 09-30), and `20260313_automation_rules.sql` alters hand-made tables. | `supabase/migrations/20260313_automation_rules.sql`, `20260313_multichannel.sql` | Renumber them when writing 034.

LOW | Tests tooling | Vitest warns "ESM syntax in a file loaded as CommonJS (vitest.config.ts)". | `npm test` output | Rename it to `vitest.config.mts`, or set `"type": "module"`.

LOW | Repo hygiene | `AGENTS.md` and `CLAUDE.md` are untracked. `next dev` re-adds AGENTS.md, and its own note says to commit it. | `git status --porcelain` | Commit both or add them to `.gitignore`.

LOW | UX | `app/dashboard/lead-finder/` has no `loading.tsx`. It's the only real section without one (`lead-scraper` is a redirect). | `ls app/dashboard/*/loading.tsx` | Add a skeleton `loading.tsx`.

## Guest workspaces (growth since 2026-09-30: 80 orgs / 4,766 rows)

- Guest orgs (`slug like 'guest-%'`): **116** (+36). 3 of them were created by this audit's `curl -sI` calls, so organic growth is **+33**. By creation day: 09-28: 8, 09-29: 20, 09-30: 88 (70 of those between 17:00 and 19:59Z).
- Rows in the 52 org-scoped tables (with `organization_id`) for guest orgs: **9,503**, or **9,619** including the org rows (+~4,850). Methodology may differ from yesterday's figure. Largest tables: activities 1,680, leads 1,660, customers 1,008, contacts 1,008, deals 840, calendar_events 664.
- 84 guest orgs are seeded and 32 are empty. Every empty one predates 2026-09-30T11Z, before seeding existed (1 exception at 17Z). Every guest since then gets ~110 demo rows.
- Auth: 120 users, 116 anonymous. 1 guest profile has no org (failed provisioning; the purge still handles it).

## Status of AUDIT-2026-09-30 items

- Still open: migration for the 13 hand-made tables; cross-tenant RLS check on them; 032 applied status (unverifiable here); delete CreateInvoiceModal; per-org public API keys; 20260313 prefix; B8 scheduling (now blocked by the two HIGH CI findings); product/infra items not re-verified here (inbound email/WhatsApp sync, Google app verification, billing, social posting, the Campaigns/Sequences merge, Apify actor limits and aborts).
- Closed or implemented: guest cleanup policy (in code, not yet exercised); AI missing-key error shown (code); `app/error.tsx` + `global-error.tsx` exist; `loading.tsx` in the dashboard sections except lead-finder; migration 033 applied.

## Verified OK

- `npx tsc --noEmit`: 0 errors. `npm run lint`: 0 errors. `npm test`: 33 files, 477 tests, all pass. `npm audit --omit=dev`: 0 vulnerabilities.
- `/` and `/dashboard/overview` both send HSTS (`max-age=63072000; includeSubDomains`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy and Permissions-Policy.
- `/dashboard` returns 404 (known).
- 17 GET API routes without auth return 401 (lead-finder x11, buffer/channels, marketing/report (400 for a malformed id, 401 for a valid uuid), public/leads, public/contacts, public/analytics). `ai/chat` and `email/send` return 405 on GET.
- All 5 cron routes return 401 with no bearer and with a wrong bearer. `verifyCronRequest` fails closed when `CRON_SECRET` is unset.
- `robots.txt` returns 200 and disallows `/dashboard` and `/api`.
- An anonymous client with no session gets **0 rows from all 75 typed tables + marketing_reports**, including all 13 hand-made tables. `ai_settings` returns 42501 (permission denied).
- Migration 033 is applied: `ai_settings.custom_base_url`, `custom_model` and `custom_fast_model` exist. Table-level SELECT on `ai_settings` was revoked in 030, so `custom_api_key` isn't readable through the 033 column grants.
- `vercel.json`: region `sin1`. Crons: `sequence-executor` at `0 8 * * *` and `daily-reset` at `0 0 * * *`. `maxDuration` is 300 for `cron/lead-finder` and `cron/lead-finder-worker`; the other crons use the platform default.
- `.env.local` is git-ignored and untracked. The guest hourly cap fails closed. There are no orphan anonymous users.
