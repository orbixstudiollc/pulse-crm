# PLAN.md — Close the verified gaps in Pulse CRM

Produced by an adversarial two-planner debate (Astra: shipping speed, Fable: correctness) on 2026-09-28. Three rounds ran: blind plans, cross-examination, and one targeted round-3 exchange on enrichment cancellation. Debate artifacts: scratchpad `afp-pulse-crm/` (brief.md, r1-*.json, r2-*.json, r3-*.json). Executable task list: `tasks.json` (23 tasks, run with `astra-fable-execute`). All verify commands run from this directory in Git Bash; ripgrep is not installed, so verifies use grep, awk and node only.

## Starting condition (verified)

- HEAD `7ca33ae` (2026-03-30) type-checks clean. Working tree: 139 changed paths uncommitted for six months, `npx tsc --noEmit` reports 156 errors, `npm run lint` exits 1 with 106 errors and 180 warnings. All 156 type errors come from the uncommitted UI-kit API change and the half-merged social-scheduling ("Postpeer") surface.
- No test runner, no tests, no CI. Push to `main` auto-deploys to Vercel; the Lead Finder worker cron runs every minute.

## Approach

1. **Make the tree green first and commit it whole.** The G1 type fixes (T1–T5) land in one commit (T6) containing every uncommitted path. This was disputed and settled by fact: `lib/security/` is untracked and imported by 42 modified tracked files, and six untracked `components/ui/*` files, `lib/env.ts` and `instrumentation.ts` are load-bearing, so no partial stage can type-check. The owner can push that first commit immediately; it also carries the middleware prefix gate so the social routes are no longer reachable unauthenticated from the first deploy.
2. **Keep the new UI-kit API (A1) and migrate ~100 call sites** rather than reverting. Every file edited since March already uses it.
3. **Gate the Postpeer surface, do not delete or wire it (A2).** Middleware prefix gate in commit 1, `getOrgId()` in each page and server action in commit 2, mock data labelled. The Buffer API routes already check `auth.getUser()`.
4. **Fix each confirmed defect at the smallest correct layer, with no schema change.** Every status value and column the fixes need already exists in migration 027. No migration file is produced, so there is no deploy-ordering hazard.
5. **Security fixes with tests for the pure parts.** vitest is installed with the first real test (merge-field escaping), then sort-column allowlisting and OAuth token sealing get tests.
6. **Delete dead code, then lint to zero errors by exit status, then the single `npm run build` gate.**

Seven commits, in order: types → auth → correctness (G3) → security (G4) → dead code → lint → docs. Every commit leaves tsc green.

## Assumptions as applied (overrule here before executing)

- **A1 kept:** new Badge/Select/Button API; old callers migrated with a fixed colour map (red→error, amber→warning, green/emerald→success, blue→info, violet→primary).
- **A2 kept:** Postpeer surface gated, labelled, unlinked, not connected.
- **A3 amended:** the untracked, unlinked, broken `app/dashboard/billing` page is deleted instead of given a client; the settings Billing tab (which already renders the same data) gets a "Default plan — not connected to a payment provider" label. Team invites are moot: `lib/actions/workspace.ts` is deleted with its only caller.
- **A4 applied:** orphaned `app/onboarding/*` flow and its actions deleted; `lib/actions/profile.ts` restored verbatim from HEAD (its six deleted functions are what the 3705-line settings client imports; the working-tree extras had no callers after the deletion). Buffer callback repointed to `/dashboard/settings`. No `onboarding_completed` column.
- **A5 applied, tightened:** OAuth tokens sealed on write, detect-on-read; a value that matches the ciphertext envelope but fails to decrypt returns null (fail closed → "please reconnect") rather than being sent as a bearer token. Both sides agreed after cross-examination.
- **A6 amended:** the three chat write tools are removed and the system prompt says the assistant cannot mutate records. The confirm-then-execute UI (`ChatActionPreview`, `/api/ai/chat/execute-action`) exists but is rendered and called by nothing, so routing proposals through it would be new client work; deferred.
- **A7 applied:** DB enum `deal_stage` wins (discovery|proposal|negotiation|closed_won|closed_lost). The stray `qualification` was in `app/dashboard/sales/[id]/client.tsx`, not where the brief guessed.
- **A8 deferred:** per-tenant public API keys.

## Task list (dependency order; details in tasks.json)

| Commit | Tasks | What |
|---|---|---|
| 1 fix(types) | T1 profile/onboarding, T2 module fixes + middleware gate, T3 Postpeer client fixes, T4 Badge migration, T5 Select migration, T6 gate+commit | tsc 0 errors, whole tree committed |
| 2 fix(auth) | T7 | `getOrgId()` in 5 pages + 8 actions, mock labels, billing label |
| 3 fix(correctness) | T8 marketing types, T9 lf_leads search, T10 Ollama URL, T11 planner actor, T12 cancellation CAS, T13 deal stages, T14 worker client, T15 add_tag + commit | G3.1–G3.8 |
| 4 fix(security) | T16 vitest + HTML escaping, T17 org-scoped enroll, T18 sort allowlist, T19 chat tools/limits, T20 OAuth sealing + commit | G4.1–G4.5 |
| 5 chore | T21 | dead code removed |
| 6 chore(lint) | T22 | `npm run lint` exits 0 |
| 7 docs | T23 | tsc, lint, test, build; PLAN.md + tasks.json committed |

T8–T13 are parallelisable after T7; T14 follows T12 (same function). T16–T19 are parallelisable after T15.

## New gap found during the debate (not in the brief)

**G3.8 — worker writes use the cookie-scoped client.** `enrichSingleLead` (pipeline.ts:58) calls `createClient()` and is invoked by the worker from the cron route and from server boot, where there is no user session. From cron the client is anonymous, RLS rejects the personalization upsert and lead update, and their errors are never checked, so the job is marked done with nothing persisted. From boot, `cookies()` throws outside a request scope. Fixed in T14 by using the admin client inside that function with explicit organization filters and by failing the job when a write errors.

## Where the planners disagreed and how it was ruled

1. **First-commit scope.** Astra: stage only a reviewed dependency closure. Fable: commit the whole tree. Ruled for Fable on the 42-importer fact; the closure is the tree. Risk recorded below.
2. **Enrichment cancellation.** Astra (rounds 1–2): a migration adding RPCs so cancellation and every worker write are transactional. Fable: status-guarded updates, no schema. Round 3: Astra conceded because push auto-deploys and the plan cannot apply migrations, so worker code depending on an RPC would stop all enrichment until someone applied the file by hand. Fable then closed most of the remaining gap with a compare-and-swap: the job row is moved running→done *before* the lead result is written, and the write happens only if that update returned a row; the cancel route's `WHERE status IN (queued,retry,running)` and the CAS's `WHERE status IN (running,retry)` are mutually exclusive single-row atomic statements on the same column. Ruled for the CAS design.
3. **Lint disables.** Astra: fix every site, no suppressions. Fable: allow a per-line disable for `react-hooks/set-state-in-effect` where the effect syncs server data into local state and a restructure changes behaviour. Ruled: allowed only for that rule, only with the reason comment, in a 3705-line client with no tests; every other rule is fixed. Verification is `npm run lint` exit status, not output wording (Astra's point; Fable's grep would have passed on a config error).
4. **vitest bootstrap.** Fable: separate task with a throwaway smoke test. Astra: install with the first real test. Ruled for Astra.
5. **Profile actions.** Astra: surgical merge keeping the working-tree `uploadAvatar` (bucket `public`). Fable: verbatim HEAD restore (bucket `avatars`, the version that was deployed and working in March). Ruled for Fable; open risk R1.
6. **Chat write tools.** Astra initially wanted structured proposals through the existing preview protocol; after learning the preview is unrendered, both agreed to remove the tools and defer. Astra's extra requirement kept: the rate-limit slot is released exactly once across finish, error and abort.

## Open risks (both positions kept; the test that settles each)

- **R1 Avatar bucket.** HEAD uploads to bucket `avatars`; the working tree used `public`. If the Supabase project only has `public`, avatar upload fails at runtime with "Bucket not found" while tsc is green. *Settle:* Supabase dashboard → Storage → buckets. If only `public` exists, change the two `storage.from("avatars")` calls in `lib/actions/profile.ts` to `"public"` after T1.
- **R2 Commit 1 size.** ~139 paths, ~18k lines in one commit the owner is told is pushable. Astra's position: unreviewed six-month-old changes ship together. Fable's: a partial stage cannot be green. *Settle:* accepted by fact; the owner reviews commit 1 with `git show --stat HEAD~6`.
- **R3 Cancellation residual.** Process death between the successful CAS and the lead write leaves job=done with no result, lead stuck `enriching` until the next enqueue or cancel resets it. During a Vercel rollover an old-code worker can move a cancelled job to `retry` once. Only a transaction (Astra's RPC) closes these; accepted as the price of no migration. *Settle:* pause a worker after claim, cancel, resume; lead data and cancelled statuses must be unchanged and no retry claimable.
- **R4 ENCRYPTION_KEY rotation** turns into a mass "reconnect your email account" event because sealed tokens fail closed. Fable initially proposed falling back to the raw value; Astra showed that sends ciphertext as a bearer token. Fail-closed kept. *Settle:* tamper a sealed token in a test and assert no provider request receives it (T20 test).
- **R5 Badge colour remap** changes the look of statuses that used violet (→primary) and emerald (→success). Cheap to reverse per site.
- **R6 vitest importing `lib/security/index.ts`** (which imports `next/server`) may fail in node env; fallback recorded in T18.
- **R7 Admin client inside `enrichSingleLead`** also applies to the per-lead enrich route, which previously wrote under the user's RLS. Mitigated by explicit organization filters on every statement; the route already authenticates and org-checks before calling.
- **R8 Deploy overlap for T12/T14.** Do not press "cancel enrichment" until the Vercel deployment shows Ready.

## Deferred (recorded, not built)

- G4.6 per-tenant hashed public API keys (single shared `PULSE_CRM_API_KEY` remains).
- G4.7 `verifyOriginCsrf` in the remaining lead-finder routes (middleware already applies the same-origin check to every non-exempt `/api/*` mutation).
- Cron automation executor lacks `assign_to`, `update_field`, `send_notification` branches.
- Wiring `ChatActionPreview` and `/api/ai/chat/execute-action` into `AIChatMessages` (a feature).
- `lib/ai/rate-limiter.ts` is per-process; a distributed limiter is out of scope.
- Overlapping `DeleteConfirmModal`/`ConfirmDialog`/`ConfirmModal` and `Toggle`/`Switch` (different prop contracts, not pure renames).
- Unused `lf_leads.last_enrich_error/last_enrich_attempt_at/enrich_attempts` columns (schema is additive-only).
- `ai_settings` rows whose `default_model` starts with `ollama:` are ignored on read and heal on the next settings save.
- `react-hooks/set-state-in-effect` sites carrying a disable comment (listed by T22 in the execution record).
- Real Postpeer integration, team invitation emails, Stripe billing.

## Rejected alternatives

- Migration 028 with `cancel_campaign_enrichment` / `finish_enrichment_job` RPCs (and, in round 1, a `lease_token` column): correct in isolation, but the plan cannot apply migrations and push auto-deploys; the worker would 404 on the RPC every minute until the file was applied by hand.
- Partial staging of a computed dependency closure with a verify-staged script: the closure is the whole tree.
- Structured `proposeAction` tool feeding `ChatActionPreview`: the preview is rendered nowhere; ~150 lines of new client wiring.
- A `client.tsx` for `/dashboard/billing`: nothing links the route; settings already renders the data.
- Surgical merge of HEAD's profile functions into the working-tree file: keeps two dead exports and silently picks a storage bucket.
- A second auth helper (`lib/auth/require-organization.ts`): `getOrgId()` already does exactly this; two gates drift.
- Calling `checkAIAccess("chat")` from the chat route: it constructs a client with a different provider order and can block orgs whose chat works.
- Parsing legacy `ollama:<url>:<model>` strings: URLs, ports, IPv6 and model tags contain colons; no unambiguous split.
- Backward-compatible `options`/`placeholder` props on Select and old colour names on Badge: violates A1 and leaves two APIs alive.
- Deleting the whole Postpeer surface: constraint 4 forbids wholesale deletion of uncommitted work; gating costs ~40 lines and deletion stays available later.
- HTML-escaping by default inside `resolveMergeFields`: four of six call sites are plain text (subject, WhatsApp, LinkedIn, message body).
- Regenerating `types/database.ts` with the Supabase CLI: out of scope; would rewrite 3455 hand-maintained lines.
- Inline `eslint-disable` for `no-explicit-any` or any rule other than the effect-sync case: weakens the gate.
- A throwaway smoke test to bootstrap vitest: install with the first real test instead.

## Execution record (2026-09-28)

Executed with `astra-fable-execute`: 24 tasks in 15 waves, Opus executors, every task gated by its own verify command. Pre-run snapshot of the whole tree (incl. untracked files) is at git ref `refs/backups/pre-execute-20260928` (`8ab5b73`).

| # | Commit | Scope |
|---|---|---|
| 1 | `e9c9691` fix(types) | T1–T6: UI-kit migration, profile restore, orphan onboarding/billing removed, middleware prefix gate. tsc 156 → 0. |
| 2 | `eabda45` fix(auth) | T7: `getOrgId()` in 5 social pages + 8 actions, mock/billing labels, POSTPEER_API_KEY documented. |
| 3 | `76ddac3` fix(correctness) | T8–T15: marketing types, lf_leads search, Ollama URL, planner actor, cancellation CAS, deal stages, worker admin client (G3.8), add_tag. |
| 4 | `73683ad` fix(security) | T16–T20: vitest 4 + merge-field escaping, org-scoped enroll, sort allowlists, chat write tools removed + limits, OAuth tokens sealed. 18 tests. |
| 5 | `663ae16` chore | T21: dead code removed. |
| 6 | `ee8062e` chore(lint) | T22: lint 106 → 0 errors (173 warnings untouched). |
| 7 | `f11d766` fix(review) | T24 (added after the judgment review): campaigns actions strip email secrets; CAS error thrown; lead status restored on unclaimed job; failed post-CAS write goes back to `running` for normal retry; HTML fallback escaped. |
| 8 | (this commit) docs | T23: PLAN.md + tasks.json. |

**Deviations from task interfaces (all reviewed):**
- T1 ran twice: the first attempt was denied as a bundled command; the second did each step separately. The empty `app/onboarding/*` directories were removed by the orchestrator after the permission layer refused `rmdir` to the executor. The T1 verify grep was narrowed to exclude `lib/linkedin`, which has an unrelated `getCurrentProfile`.
- T3: `ConfirmDialog isLoading` → `loading` (required by tsc); `key={selectedPlatforms.join(",")}` on the compose Tabs so the preview resets when the selection changes; MediaUploader uses a real `<button>` driving the file input ref.
- T4 touched two undeclared files to reach tsc 0: `app/dashboard/calendar/client.tsx` (one Badge value) and `app/dashboard/leads/[id]/client.tsx` (colour map). Scope drift vs the snapshot: `app/dashboard/calendar/client.tsx` only.
- T5: where the source array was itself a `.map` to `{label,value}`, callers map straight to `<option>`; rendered output identical.
- T8: the marketing `client.tsx` prop interfaces were not on the file list, so the two `page.tsx` files normalise `progress ?? 0` and JSON `result`/`content` via a small `toRecord` helper; `dimensionResults` typed as `Parameters<typeof finalizeFullAudit>[1]`.
- T12: personalization upsert and lead update now throw on `{ error }` (they were silently ignored); cancel counts via `{ count: "exact" }`.
- T14: `lf_lead_personalization` has no `organization_id` column, so that upsert stays scoped by the org-checked `lead_id`.
- T16: vitest 5 requires `@types/node ^22`; installed `vitest ^4.1.11` (peer-compatible with the pinned `@types/node ^20`). Only new dependency.
- T19: handler parameter is `req`, so `req.signal`; added `onError` logging because supplying `onError` replaces the SDK default.
- T20: `OAuthTokens` is a `type` alias (an `interface` is not assignable to Supabase's `Json`); `getValidAccessToken` returns null when no refresh token exists (previously would have sent the string "undefined").
- T22: three sites earmarked for a disable (settings mounted flag, AIChatInput, SlashCommandMenu) were restructured instead because they do not sync server data. Six `react-hooks/set-state-in-effect` disables remain, all with the reason comment: copilot/client.tsx (~338), inbox/client.tsx (~183, ~195), settings/client.tsx (~2163, ~2512, ~2855). `use-lead-events.ts` needed an additional refs fix that the use-before-declare error had masked. TimePicker uses a previous-value compare during render, not `useMemo`.
- T24 file list amended to include `app/dashboard/campaigns/client.tsx` (its `EmailAccount` type is now `Omit<Row, secrets>`).
- No test file had to be dropped; `lib/security/index.ts` imports fine under vitest node env.

**Judgment review (adversarial Opus pass over the snapshot→HEAD diff):** no critical findings. HIGH (campaigns email-account rows leaking tokens) and the two MEDIUM (lead stuck `enriching` on a failed CAS; permanent job failure on a transient post-CAS write) were fixed in commit 7. Remaining LOW items, deferred:
- `components/features/DealDrawer.tsx` ~:434 casts `activity.badge_variant as BadgeVariant`; rows with legacy colour names would render unstyled (no writer produces them today).
- `lib/actions/website-visitors.ts` ~:145 still orders by raw `sortBy` (not one of the four plan sites).
- `lib/actions/email-accounts.ts` still returns `smtp_config`/`imap_config` (password already encrypted) to the settings client.
- `ENCRYPTION_KEY` is now required at runtime for OAuth account connect/refresh (it was already required for SMTP passwords). **Confirm it is set in Vercel before pushing.** Existing plaintext token rows are sealed lazily on their next refresh; there is no backfill script.
- Rollover note: do not press "cancel enrichment" until the new deployment shows Ready (an old-code worker can move a cancelled job to `retry` once).

**Final gates on HEAD:** `npx tsc --noEmit` 0 errors; `npm run lint` exit 0 (0 errors, 173 warnings); `npm test` 18/18; `npm run build` run by T23 below.
