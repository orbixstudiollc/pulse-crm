# PLAN-followup.md: security leftovers, restyle leftovers, testing-phase polish

Produced by the astra-fable-plan debate on 2026-09-29 (2 rounds; round 3 not needed). Brief and round artifacts: scratchpad `afp-pulse-followup/`. Task handoff: `tasks-followup.json` (18 tasks, 10 opus / 8 sonnet). Previous plans: `PLAN.md` (gap closing), `PLAN-ui.md` (restyle), `PLAN-security.md` (critical/high security).

## Approach

Three workstreams, one migration, every file path verified against the tree by the planner that could read it (Fable), with Astra's shipping-speed critique applied where it found real gaps.

- **Security leftovers.** Every user-client read of `ai_settings` that touches a secret column moves to the service role behind the existing profile/org check, so the column re-grant in `030_followup.sql` is pure hardening and the code is correct before and after it is applied. A column-level `REVOKE SELECT (cols)` alone is a no-op while Supabase's table-level grant exists, so 030 revokes table SELECT/UPDATE/INSERT from `authenticated` and re-grants explicit column lists. Minimal RBAC (`requireRole('admin','owner')`) gates destructive and settings actions; workspace creators are written as `admin`; 030 back-fills `admin` for sole-member organisations only. The automation engine leaves the server-action module for a `server-only` runner with a field allowlist and org-scoped writes. Ollama SSRF is closed by a pinned-DNS fetch injected into the OpenAI client plus DNS validation at both write sites. Tracking, mail transports, Obsidian paths, sort allowlists, set-default writes and dead CSRF code are each one bounded task.
- **Restyle leftovers.** Four mechanical Sonnet tasks: hovers/weights/copilot height/FormRow, breadcrumb labels + `formatEnumLabel`, chart series colours, toasts + Cancel-as-outline + dark `--line`.
- **Testing-phase polish.** Daily purge of expired anonymous guests (guest email AND `is_anonymous` AND no other member in the org), a shared pure seed generator used by both the "Load sample data" action and guest provisioning (seeded once, by the request that won the conditional profile update), a fail-closed global hourly cap on guest creation with a static try-later page, bot skipping, `robots.txt`, and a 5-minute GitHub Actions schedule for the two lead-finder crons that Hobby cannot run.

## Assumptions as applied (overrule before executing)

- **AS1** One migration `supabase/migrations/030_followup.sql`, owner-applied in the SQL editor; application code never depends on it. It contains: ai_settings SELECT/UPDATE/INSERT column grants, `lead_id` checks on two 028 policies, `SET search_path` + EXECUTE revokes on six SECURITY DEFINER RPCs, sole-member admin backfill.
- **AS2** RBAC is `requireRole('admin','owner')` on: clear-all-data, email/WhatsApp/LinkedIn account add/delete/disconnect, PostPeer disconnect, `updateAISettings`, and any organisation-settings updater the T2 executor finds. No role-management UI. Creators (onboarding and guest provisioning) become `admin`.
- **AS3** Security headers are the hard, non-breaking set (nosniff, referrer policy, frame denial, permissions policy, HSTS). No script CSP, no report-only CSP.
- **AS4** Guest retention 7 days (`GUEST_RETENTION_DAYS`), seeding on (`GUEST_SEED_DEMO_DATA` != `false`), global cap 200 guest workspaces per hour (`GUEST_SIGNUPS_PER_HOUR`), fail closed when the count query errors.
- **AS5** Cancel buttons (8, all single-line) become `outline`; dark `--line` becomes `#2a2a2a`.
- **AS6** No new npm dependencies. Ollama pinning reuses the undici agent already in `lib/security/safe-fetch.ts`.
- **AS7** GitHub Actions workflow is on by default (repo is public, minutes are free) and no-ops with a visible warning until the owner adds the `CRON_SECRET` repository secret.
- **AS8** B9 (auth hero PNGs) is out of scope: no Playwright dependency and the auth pages are unreachable in open-access mode.

## Tasks (dependency order; details and verify commands in tasks-followup.json)

| Task | Model | Workstream | What |
|---|---|---|---|
| T1 | opus | A | `030_followup.sql`: ai_settings column grants, `lead_id` policy checks, RPC lockdown, sole-member admin backfill |
| T2 | opus | A | `lib/auth/roles.ts` + `requireRole`; creators become admin; race-safe `provisionGuestWorkspace`; gates on destructive account/data actions |
| T3 | opus | A | ai_settings secrets read via service role in the action, AI client, chat route, lead-finder settings GET, OpenRouter callback; `pickWritableAISettings` allowlist |
| T4 | opus | A | `createPinnedFetch` for the Ollama OpenAI client; `assertSafeFetchTarget` on both `ollama_base_url` writers |
| T5 | opus | A | Automation engine to `lib/automation/runner.ts` (server-only), `UPDATE_FIELD_ALLOWLIST`, org-scoped writes, cron gains assign_to/update_field/send_notification and records results |
| T6 | sonnet | A | Security headers in `next.config.ts` |
| T7 | opus | A | Tracking endpoint: 16 KiB body cap, zod schema, trusted IP parsing, HTTPS geolocation, per-script token bucket |
| T8 | opus | A | Tenant-bound Obsidian vault path; SMTP/IMAP host+port validation at create, update, test and send; generic test errors |
| T9 | sonnet | A | Visitor sort allowlist, set-default org filters, delete dead `verifyOriginCsrf`, document best-effort AI limiter |
| T10 | sonnet | B | No-op hovers, duplicate font weights, copilot height, delete `FormRow` |
| T11 | sonnet | B | Breadcrumb labels (ICP, Website visitors) and `formatEnumLabel` |
| T12 | sonnet | B | Distinct funnel colours; `chartSeriesExtended` for the two pies (after T10, shared file) |
| T13 | sonnet | B | Toast variants and top placement, Sonner styling in globals.css, Cancel to outline, dark `--line` (after T11, shared files) |
| T14 | opus | C | Guest purge in the daily cron: pure predicate, `is_anonymous` + sole-member checks, org then auth user deletion |
| T15 | opus | C | `lib/seed/generate.ts` + `insert.ts`; seed action and guest provisioning share it; seeded once by the winning request |
| T16 | opus | C | Bot skip, fail-closed hourly guest cap with `/try-later`, `robots.txt` |
| T17 | sonnet | C | `.github/workflows/lead-finder-cron.yml` every 5 minutes, loud no-op without the secret, red run on any failed request |
| T18 | sonnet | gate | lint, tests, build, restyle scan, contrast, audit (read-only; no commit) |

Executor rules: edit only declared files; no git state changes (the verify commits); never touch `PLAN*.md` or `tasks*.json`. Waves run in parallel in one tree; shared files are serialised by `depends_on` (T3→T2, T4→T3, T8→T2, T9→T2, T15→T2, T16→T15, T12→T10, T13→T11); drift is caught by `gate.sh scope` after the last wave. `npm run build` in T18 needs `ENCRYPTION_KEY` and the public Supabase vars in the executor shell.

## Where the planners disagreed and how it was ruled

| Issue | Astra (speed) | Fable (correctness) | Ruling |
|---|---|---|---|
| Ollama SSRF | Disable tenant-configured Ollama in production unless the platform sets `OLLAMA_BASE_URL`; no fetch adapter | Pinned-DNS fetch injected into the OpenAI client, validation at both writers | **Fable.** Keeps a real feature (hosted Ollama on a VPS) and reuses the existing undici agent; the host-mismatch guard is unit-tested. Fact that would flip it: `SELECT count(*) FROM ai_settings WHERE ai_provider='ollama' OR ollama_base_url IS NOT NULL` returning 0 on the live DB. |
| Admin backfill in 030 | Earliest member of any admin-less org (round 1), then sole-member only (round 2) | Sole-member organisations only | **Both agree (sole-member).** `profiles.created_at` is signup time, not creatorship. Multi-member admin-less orgs (none today) are listed for the owner. |
| Guest cleanup mechanism | SECURITY DEFINER RPC with row locks in 030, skip cleanup until applied | JS purge: guest email AND `is_anonymous` AND zero other members, works from day one | **Fable.** No code path adds a second member to an org today, so there is nothing to race; the JS check gives the same guarantee without privileged SQL and without waiting for 030. Astra's blocking concern (deleting an org with a real member) is covered by the membership check. |
| Verification depth | Disposable-Supabase integration harness as a required gate | Discriminating greps + targeted vitest + the owner's PostgREST check after 030 | **Fable.** No staging project exists; a verify that refuses to skip fails deterministically. |
| Preflight inventory task | A T1 that exits non-zero until every path is reconciled | Paths verified with `test -e` this round | **Fable.** Astra dropped it in round 2 after Fable's inventory. |
| `server-only` in tests | Test the runner directly | Test only pure modules; runner imports `server-only`, which throws under vitest | **Fable.** Verified: `node -e "require('server-only')"` throws without the react-server condition. |
| Workflow failure visibility | Final job must fail if any request failed | `continue-on-error` on both curl steps | **Astra.** Both routes are still attempted, then a final step fails the run if either outcome was failure. |
| Mail validation boundary | Also on configuration updates and at the connection | Create, test and send | **Astra.** `updateEmailAccount` validates too; at least two `assertSafeMailHost` call sites in the file. |
| Cron consuming executor results | Record per-action results and failures | Keep the insert unchanged | **Astra.** `actions_executed: results`, `success: results.every(...)`, `error_message` from failures. |
| Shared-file serialisation | Claimed complete but was not | T10/T12 and T11/T13 ran in one wave | **Astra.** Two dependency edges added. |
| Tracking token bucket | Bounded store | Unbounded Map (round 1) | **Astra.** Fable adopted eviction above 10 000 idle entries. |
| Guest cap on DB error | Fail closed | Fail open (round 1) | **Astra.** Fable adopted fail-closed with `Retry-After: 3600`. |
| Seed idempotency | Deterministic UUIDs + conflict-ignore upserts | Seed only in the request that wins the conditional profile update | **Fable.** The only concurrent path is a user racing itself; the conditional update closes it. |
| Workflow default state | Off behind a repo variable | On, loud no-op without the secret | **Fable.** The repo is public; minutes are free. |

## Open risks

1. **Column grants break a read the plan missed.** After 030, any surviving user-client `ai_settings` select naming a secret column returns 42501 and its page goes blank. T3 moves the five verified sites; the owner smoke-checks `/dashboard/settings`, `/dashboard/lead-finder/settings` and the AI chat right after applying 030. Rollback: re-run `GRANT SELECT ON ai_settings TO authenticated`.
2. **Deploy-before-030 window for existing orgs.** With T2 deployed and 030 not yet applied, a pre-existing single-member org whose profile is `member` gets "Forbidden: admin role required" on the gated actions. Clear error, no data loss; apply 030 in the same session as the deploy.
3. **Pinned fetch and the OpenAI SDK.** undici's Response type differs from lib.dom's; T4 casts and forces `redirect: 'manual'`. If the SDK bypasses the injected fetch for some call, the pin is silently absent: the host-mismatch test covers the wrapper, not the SDK's use of it.
4. **Guest provisioning latency.** The seed runs inside the middleware on the first anonymous request (about 120 rows, parallel inserts). If a cold free-tier Supabase makes this exceed about 2 s, move the seed to `after()` in a follow-up; `GUEST_SEED_DEMO_DATA=false` disables it immediately.
5. **Fail-closed cap during a Supabase outage** shows every new visitor the try-later page while the count query errors. Accepted: returning guests with cookies are unaffected.
6. **Tracking rate limit is per instance** on Fluid compute (effective limit N × 60/min). Body cap, zod caps and IP validation bound the damage per row.
7. **GitHub schedules** can be delayed and are disabled after 60 days without repository activity; the owner must add `CRON_SECRET` as a repository secret or the workflow warns and skips.
8. **`server-only` under vitest.** Any test that imports the runner or another server-only module fails at import; T18 greps `tests/` for the string.

## Owner actions (not automatable from the repo)

- Apply `030_followup.sql` in the Supabase SQL editor right after the deploy; then confirm `GET /rest/v1/ai_settings?select=api_key` with a member JWT returns 42501, and smoke-check the three pages in risk 1.
- Add `CRON_SECRET` (same value as the Vercel env var) as a GitHub Actions repository secret.
- Optional env vars on Vercel: `GUEST_RETENTION_DAYS`, `GUEST_SEED_DEMO_DATA`, `GUEST_SIGNUPS_PER_HOUR`.
- Resolve any multi-member organisation without an admin listed by the query in 030's comment.

## Rejected alternatives

- Preflight inventory task and per-task AST checker scripts (Astra round 1): the repository was readable; inventories are facts.
- Disposable-database integration harness as a required gate: no staging project; fails deterministically.
- SECURITY DEFINER RPC for guest deletion with row locks: no join path exists to race against; adds privileged SQL surface and waits for 030.
- Disabling tenant Ollama in production: kills a realistic hosted-Ollama use and leaves the URL reachable outside production.
- Column-level `REVOKE SELECT (cols)` as worded in the brief: ignored by PostgreSQL while the table-level grant exists.
- Earliest-member admin promotion: `created_at` does not prove creatorship.
- Deterministic seed UUIDs with conflict-ignore upserts: no additional safety over the conditional update.
- Default-disabled workflow behind a repository variable: only creates a silent-off state.
- Wiring `verifyOriginCsrf` into lead-finder routes: middleware already enforces same-origin on non-exempt `/api` mutations; deleting the dead helper is smaller.
- Per-IP guest-signup table: a migration and a write per visit for a testing-phase cap.
- Report-only CSP: cannot be proven harmless without a browser run and has no report endpoint.
- Regenerating auth hero PNGs with Playwright: no dependency, pages unreachable in open-access mode.
- `is_seed` marker columns across ~15 tables so clear-all deletes only seeded rows: the UI already says "Clear All Data"; the admin gate suffices for now.
- Folding the lead-finder worker into the daily cron: one batch per day makes the lead-finder unusable for testing.

## Execution record (2026-09-29)

Run with `astra-fable-execute` on `tasks-followup.json`, 4 waves + 1 review-fix wave, 22 tasks, 25 commits on top of `9b31ee8` (not pushed at time of writing).

- **Passed first attempt:** T1, T3, T4, T6, T7, T8, T10, T11, T12, T13, T14, T15, T16, T17, T18, R1, R2, R3, R4.
- **Plan defects repaired mid-run (same executor, file added to the task):** T5 (`components/automation/AutomationSection.tsx` still imported `seedDefaultRules`; interface said 0 callers); T2 (`lib/actions/campaigns.ts` `updateBookingConfig` gated per the merge ruling); T9 (verify wanted 3 org filters but the interface produced 2: ruled for an ownership pre-check on set-default, which also closes a real gap where a foreign account id stripped the caller's default).
- **Verify-authoring defects:** R3 and R4 greps were wrong (argument order; substring matching unrelated copy). Fixed in the plan, not in the code.
- **Model escalations:** none. No Sonnet task needed the Opus retry.
- **Scope drift:** none across all 25 commits.
- **Judgment review (Opus, adversarial):** 0 CRITICAL, 0 HIGH, 3 MEDIUM (M1 SMTP send-time DNS, M2 ungated parallel writers, M3 tracking bucket keyed on unvalidated script_key), 6 LOW. M1-M3, L1, L2, L5 fixed in R1-R4.
- **Open findings not fixed here:** L3 the `obsidian_vault_path` setting is still accepted by the UI/PUT but ignored by the observer (product decision: remove the field or surface the tenant path); L4 custom SMTP accounts on ports other than 25/465/587/2525, or relays without STARTTLS on 25/2525, now fail to send (intended trade-off, undocumented to users); L6 guest cleanup scans 200 profiles unordered and can stall on permanently skipped rows; RLS on email/whatsapp/linkedin accounts has no role predicate, so the requireRole gates hold only for server actions, not direct PostgREST calls (would need migration 031).
- **Owner actions after deploy:** apply `supabase/migrations/030_followup.sql` in the same session as the deploy; add `CRON_SECRET` as a GitHub repository secret; optional `GUEST_RETENTION_DAYS`, `GUEST_SEED_DEMO_DATA`, `GUEST_SIGNUPS_PER_HOUR` on Vercel.
