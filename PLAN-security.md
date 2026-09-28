# PLAN-security.md: close the CRITICAL and HIGH security-audit findings

Produced by the astra-fable-plan debate (2 rounds, round 3 not needed) on 2026-09-29. Brief and round artifacts: scratchpad `afp-pulse-sec/`. Audit report: scratchpad `security-audit.md`. Task handoff: `tasks-security.json` (13 tasks, 3 waves).

## Approach

Every finding is closed in application code first, in small plain modules that vitest can cover, and one idempotent migration `supabase/migrations/028_security_hardening.sql` adds the database-side defence. The migration is applied by hand by the owner (no Supabase CLI link in the repo), so:

- **C1 (tenant takeover via `profiles.organization_id`)** is closed at the application boundary by the profile allowlist the moment the code deploys, and at the database boundary only when 028 is applied. Until then a direct PostgREST PATCH still works. The final report must say which of the two has happened.
- **H3 (tables without RLS)** likewise: the application reader is scoped on deploy; anon-key access to the two tables closes only with 028.
- Everything else (H1, H2, H4, H5, H6, H7, H8) is closed by code alone.

Dependencies are chosen for the runtimes we actually have: `dompurify` in the browser with a fail-closed guard (the inbox never server-renders message bodies), `undici@7` for the pinned fetch (Node floor 20.18; the machine runs 24.11.1, which is below `isomorphic-dompurify` and `undici@8` floors).

## Assumptions as applied (overrule before executing)

- **A1** One migration file, owner-applied. Code-side enforcement is complete on its own; the DB side is defence in depth for everything except the two boundary cases above.
- **A2** `ENCRYPTION_KEY` is set in Vercel (already required for OAuth mailboxes). Sealing a new WhatsApp/LinkedIn token throws a clear action error if it is not; existing plaintext tokens keep working through the legacy pass-through.
- **A3** Inbox sanitizer: `dompurify@3` at render time, browser only, `sanitizeEmailHtml` returns `""` without a DOM. `body_text` is never rendered as HTML. Inline `style` is forbidden (a fixed-position overlay is a phishing vector in a CRM inbox).
- **A4** SSRF: resolve-then-check AND connection pinning. The address the guard approved is the only one the socket can connect to, via undici's own `fetch` + `Agent({ connect: { lookup } })`. Response capped at 1 MiB, one 10 s deadline.
- **A5** `updateSequenceSettings` gets a strict zod schema of exactly the ten keys the UI sends (`app/dashboard/sequences/[id]/client.tsx:575-586`).
- **A6** PostPeer becomes single-tenant: only the org whose id equals `POSTPEER_OWNER_ORG_ID` may use connections/compose; unset disables the feature for everyone. Per-tenant PostPeer keys rejected (new product surface: settings UI, key storage, ownership records; there is no callback route today).
- **A7** Apify: a campaign may use a built-in actor (`ACTOR_REGISTRY`) on any credential, and a custom actor only when the org has its own Apify key. The credential is resolved once as a `{ token, source }` snapshot and the run uses exactly that token (no TOCTOU). Worker/cron paths load tenant settings with the admin client scoped by `organization_id`. Platform-key fallback for LLM calls stays (M3 is out of scope).
- **A8** No UI redesign. AI key inputs start empty and show a "Saved" placeholder; a key is sent only when typed. Clearing a key from that page is no longer possible (the lead-finder settings route still replaces keys). Recorded as a trade-off.
- **A9** The 14 tables with no migration in the repo (`tracking_scripts`, `website_visitors`, `website_visits`, `copilot_conversations`, `copilot_memory`, `copilot_messages`, `copilot_tasks`, `lead_searches`, `scraped_leads`, `apify_scraper_runs`, `campaign_tags`, `sequence_tags`, `sequence_email_accounts`, the `avatars` bucket) cannot be fixed from the repo. Owner action: run Supabase's Security Advisor after applying 028.

## Tasks (dependency order; details and verify commands in tasks-security.json)

| Task | Finding | What | Wave |
|---|---|---|---|
| T1 | C1 | `lib/profile/allowlist.ts` pure `pickProfileUpdates`; `updateProfile` and `updatePreferences` use it; tests | 1 |
| T2 | H1 | `isPrivateHostname` on `net.BlockList` (bracketed/mapped IPv6, zone ids, trailing dot); `assertSafeFetchTarget` resolves DNS with injectable lookup; `fetchPinnedText` on `undici@7` with pinned lookup, 1 MiB cap, manual redirects; tests incl. `pinned.invalid` proof | 1 |
| T3 | H1 | `fetchWebsiteContent` and `scrapeWebsiteForMemory`: `getOrgId()` first, then target check + pinned fetch | 2 |
| T4 | H2 | `sanitizeEmailHtml` (dompurify, hooks for data-image and link rel), inbox renders sanitized HTML or escaped text; jsdom tests + SSR fail-closed test; build | 2 |
| T5 | C1/H3/H5 | `028_security_hardening.sql`: profile trigger + WITH CHECK, RLS + policies on `automation_executions` and `campaign_leads`, lead-aware `sequence_enrollments` policy, service-role policies, owner verification footer | 1 |
| T6 | H3 | `getAutomationExecutions` joins `automation_rules!inner` and filters by the caller's org | 1 |
| T7 | H4 | `PublicAISettings` with `has_*` booleans; pure `toPublicAISettings`/`omitBlankAISecrets` in `lib/ai/public-settings.ts` with tests; explicit column selects; settings UI sends keys only when typed | 1 |
| T8 | H4 | `lib/utils/channel-token.ts` seal/open (reuses `isSealedValue`); WhatsApp/LinkedIn tokens encrypted at rest, opened in senders, list actions select public columns (also drops `webhook_secret`); tests | 1 |
| T9 | H5 | Sequence executor: every `from("leads")` and the configured `from("email_accounts")` lookup filtered by `sequence.organization_id`; `resolveMergeFields`/`buildMergeContext` take `orgId` | 1 |
| T10 | H5 | `lib/tenancy/guards.ts` `allIdsBelongToOrg`; `enrollLead*` and `launchCampaignRun` verify ownership before writing; `SequenceSettingsSchema` in `lib/security/sequence-settings.ts` with tests | 1 |
| T11 | H6 | `requirePostPeerOrg()` gate in all PostPeer actions; `.env.example` documents `POSTPEER_OWNER_ORG_ID` | 1 |
| T12 | H7 | `evaluateActorPolicy` (pure, tests), `authorizeActors` credential snapshot, `startActorRun` and campaign create/update enforce it, admin-scoped tenant key loading, validate route passes orgId | 1 |
| T13 | H8 | `next 16.3.6`, `eslint-config-next 16.3.6`, `nodemailer 10.0.12` exact, `@types/nodemailer` removed, `npm audit fix` (no force, no `>=` overrides), jsonTransport smoke of the sendMail pipeline; final lint/test/build/audit gate: 0 critical, 0 high | 3 |

Executor rules: edit only declared files; no git state changes (the verify commits); never touch `PLAN*.md` or `tasks*.json`. Tasks in a wave run in parallel in one working tree, so the verifies do not fence the working tree; undeclared changes are caught by `gate.sh scope tasks-security.json` after the last wave.

## Where the planners disagreed and how it was ruled

| Issue | Astra (speed) | Fable (correctness) | Ruling |
|---|---|---|---|
| Profile trigger gate | `auth.role() IS DISTINCT FROM 'service_role'` (a missing claim must not bypass) | `auth.role() IS NOT NULL AND auth.role() <> 'service_role'` (NULL = SQL editor/Dashboard, the owner's only admin tools; RBAC is out of scope) | **Fable.** PostgREST requests always carry a role claim, so both are fail-closed for the API; Astra's version locks the owner out of administering roles, which is how a trigger gets disabled "temporarily". Owner test in the 028 footer: `select auth.role();` in the editor returns NULL. |
| Whether 028 is "defence in depth" | Required for closure of C1/H3 at the DB boundary | Code stands alone | **Astra, on reporting.** The plan keeps both layers; the final report must state DB-boundary closure as pending until the owner applies 028. Test: PATCH own profile via PostgREST before and after. |
| DNS rebinding | Accept the residual (round 2) | Pin the connection (round 2, stealing Astra's round-1 idea) | **Fable.** The residual is the exact attack H1 names (credential theft is unrecoverable); the pin is ~30 lines with a deterministic `pinned.invalid` test. Mechanism: undici's own fetch, not the global fetch's `dispatcher`, so Agent and fetch are one package. |
| Sanitizer | `isomorphic-dompurify` + `serverExternalPackages` | `dompurify` browser-only, fail-closed guard | **Fable.** `isomorphic-dompurify@4` requires Node ^22.22.2 or ^24.15.0; the machine runs 24.11.1 and Vercel's patch level is unpinned. The inbox never SSRs bodies (`InboxClient` gets no props; messages load in `useEffect`). |
| Onboarding rewrite | Move org creation into a new module with precondition and rollback | Leave it: `completeOnboarding` already writes with the admin client (`lib/actions/auth.ts:163-183`) | **Fable.** No finding behind the rewrite; it is the one flow C1 can regress. |
| Verification style | AST checker script per task + inventory doc | Discriminating greps/counts + pure-function tests | **Fable.** Executor-written checkers grade their own work; several of Astra's round-1 greps passed on the unmodified tree. Astra conceded in round 2. |
| SMTP after nodemailer 10 | Loopback SMTP fixture + extracted transport module | tsc + build + existing suite | **Split.** No loopback server; T13 runs a `jsonTransport` send through nodemailer 10 (exercises `createTransport`/`sendMail` without network) and requires the executor to read the 9.0/10.0 changelog entries for transport/TLS changes. |
| Apify credential TOCTOU | One `{ token, source }` snapshot | (round 1) separate lookups | **Astra.** Fable adopted it; `startActorRun` no longer re-resolves the token. |
| Dependency overrides | Explicit versions only; overrides exact and only for remaining HIGH/CRITICAL | `>=` overrides fallback | **Astra.** Verify rejects any `>=` override. |
| Testable projections | Pure `toPublicAISettings`/`omitBlankAISecrets` + tests; schema module + tests | Inline in the action | **Astra.** Cheap and it is the logic that decides what reaches the browser. |

## Open risks

1. **undici `connect.lookup` semantics.** Node's `net.connect` may call the lookup in the `all: true` form (autoSelectFamily) or the single form; if neither is honoured, fetch resolves DNS itself and the rebinding window silently reopens. Test: `tests/safe-fetch.test.ts` requests `http://pinned.invalid:PORT/`, a name that cannot resolve, and must succeed only through the pin; the unpinned control must fail.
2. **Trigger gate vs this project's JWT claims.** Migration 002 records a historical `auth.role()` mismatch. Blocking every non-NULL, non-`service_role` claim is fail-closed for PostgREST; if the service-role key's claim were ever not `service_role`, onboarding would break after 028. Owner test in the footer: complete one fresh signup right after applying.
3. **Fail-closed sanitizer if the inbox is ever server-rendered.** Bodies would render empty until hydration (a flash, never unsanitized HTML). Pinned by `tests/sanitize-html-ssr.test.ts`.
4. **nodemailer 10 / Next 16.3.6 are majors/minors that can break the build.** T13 is last and gates on tsc, lint, tests, build; anything outside its three files is escalated, not improvised. Middleware files are untouched, so the framework version is the only variable for the CSRF/route gating.
5. **Executor lead filter skips foreign or moved leads forever.** Intended fail-closed behaviour (same path as a deleted lead today).
6. **Parallel wave in one tree.** A `tsc` in one task's verify can fail on another task's half-edited file. Retry once after the wave settles before escalating.
7. **Dropping empty secret fields removes "clear my key" from the settings page** (A8). Lead-finder settings route still replaces keys.
8. **`ENCRYPTION_KEY` unset in Vercel** breaks new channel connections with an explicit error (A2).

## Owner actions (not automatable from the repo)

- Apply `supabase/migrations/028_security_hardening.sql` in the Supabase SQL editor, then run the footer checks (`select auth.role();` is NULL; one fresh signup completes; a PostgREST PATCH of your own `organization_id` now fails with 42501).
- Set `ENCRYPTION_KEY` (any long random string) and, if PostPeer is used, `POSTPEER_OWNER_ORG_ID` in Vercel.
- Run Supabase Security Advisor for the tables in A9.
- Re-run `npm audit --omit=dev` after deploy; low findings in `ai`/`@ai-sdk/*` remain by design.

## Rejected alternatives

- Column-level `REVOKE UPDATE (organization_id, role) ON profiles FROM authenticated`: opaque PostgREST errors, GRANT drift when later migrations regrant; the trigger is explicit and idempotent.
- Sandboxed `<iframe srcdoc>` for email bodies: fixed heights or `allow-scripts` for autosize, loses prose/dark styling, not unit-testable in node.
- Sanitize only at ingestion: stored rows stay dangerous and every future writer is a new hole.
- Masked key strings from `getAISettings`: still leaks key tails and invites the client to echo them; booleans carry what the UI needs.
- Per-tenant PostPeer keys (see A6).
- Global-fetch `dispatcher` pinning with an npm undici Agent: Next's patched fetch wraps Node's bundled undici; a silently dropped dispatcher would reopen the window while every check passes.
- `npm audit fix --force`: would bump `ai`/`@ai-sdk/*` majors.
- A repository inventory doc and a rollout doc under `docs/`: the migration footer and this file carry the owner steps; no new repo docs.

## Execution record (2026-09-29)

Executed with `astra-fable-execute`: 13 tasks in 3 waves (10 parallel, 2 parallel, 1), Opus executors, each task gated by its own verify. Snapshot ref before execution: `refs/backups/pre-sec-20260929`. Diff to HEAD: 50 files, +2777/-525. Scope drift against declared file lists: none. No task was retried or escalated.

| # | Commit | Task | Finding |
|---|---|---|---|
| 0 | `98e5431` docs | plan and tasks | |
| 1 | `d9376cb` | T6 org-scoped automation execution log | H3 |
| 2 | `840c4b7` | T5 `028_security_hardening.sql` | C1/H3/H5 |
| 3 | `db7501c` | T11 PostPeer owner-org gate | H6 |
| 4 | `af851cc` | T10 ownership checks + settings schema | H5 |
| 5 | `539aeb0` | T9 executor and merge-engine org filters | H5 |
| 6 | `69536e0` | T7 public AI settings | H4 |
| 7 | `bd4da24` | T8 channel tokens sealed | H4 |
| 8 | `c0efc0f` | T2 SSRF guard, DNS check, pinned fetch | H1 |
| 9 | `385632c` | T12 Apify credential snapshot + actor policy | H7 |
| 10 | `c5ae663` | T1 profile allowlist | C1 |
| 11 | `a7ed59a` | T3 SSRF callers | H1 |
| 12 | `4a717db` | T4 inbox sanitizer | H2 |
| 13 | `bb2f43d` | T13 next 16.3.6, nodemailer 10.0.12, audit fixes | H8 |
| 14 | `98f86f3` | T14 judgment-review fixes (see below) | H5b, H2, H1 |
| 15 | (this commit) docs | this record; verify patches and T14 in tasks-security.json | |

**Final gate on `bb2f43d` (T13):** `npx tsc --noEmit` 0 errors; `npm run lint` 0 errors (175 warnings, pre-existing families); `npm test` 251/251 across 13 files (was 167); `npm run build` ok; `npm audit --omit=dev` `{"info":0,"low":0,"moderate":0,"high":0,"critical":0}` (was 1 critical, 4 high, 1 moderate, 5 low). No `overrides` were needed: `npm audit fix` without `--force` moved `ws` to 8.22.0 and the `ai`/`@ai-sdk/*` chain within range. nodemailer CHANGELOG 9.0.0 (TLS validation when fetching remote content, unused here) and 10.0.0 (Node >= 20, bundled types) required only the import form change in `lib/email/sender.ts`.

**Plan defects fixed in the verifies during execution (recorded, not hidden):** T11 committed `.env.example`, which `.gitignore` excludes (`.env*`), so it was dropped from the commit list and the edit stays local; T8 expected 4 reads of `account.access_token_encrypted` while its own interface prescribes 5; T9 expected 12 `resolveMergeFields(` lines where the file has 6.

**Executor deviations accepted:** T2 split `PRIVATE_BLOCKLIST` into per-family `BlockList`s because Node checks IPv4 addresses against IPv6 rules too (`::ffff:0:0/96` would have rejected every public IPv4). T4 added a hook branch that drops non-raster `data:` image sources (DOMPurify's default `DATA_URI_TAGS` includes `img`). T12 also routes `pollRunUntilDone`/`fetchDatasetItems` through `authorizeActors(orgId, [])` and rejects a non-array `apify_actors`. T10 returns "Sequence not found" from `enrollLeadsBulk` too. T1 makes an empty `updatePreferences` patch an error instead of an empty update. T11's placement of the gate inside the `try` in `connections.ts` turns a `getOrgId` redirect into an action error for users without an org (they cannot reach those pages anyway). T7 widens the row type for the three secret columns absent from `AISettings`.

**Behaviour changes for legitimate users:** AI keys can no longer be cleared from the settings page (A8); non-numeric sequence-settings inputs are rejected instead of stored as NaN; PostPeer features are disabled for every org except `POSTPEER_OWNER_ORG_ID`; custom Apify actors require a tenant key; new WhatsApp/LinkedIn connections require `ENCRYPTION_KEY`.

**Closure status:** H1, H2, H4, H5 (application), H6, H7, H8 closed on deploy. C1 and H3 are closed at the application boundary on deploy and at the database boundary only once the owner applies `028_security_hardening.sql` (direct PostgREST writes remain possible until then). The legacy `lib/actions/apify.ts` maps a fixed source enum to actor ids and does not take tenant-chosen actors, so it is not a policy bypass.

### Judgment review (Opus, read-only, refs/backups/pre-sec-20260929..HEAD) and fixes (T14, `98f86f3`)

Verdict before fixes: "safe to push, but not yet safe to call C1 and H1-H8 closed". The reviewer probed the pinned lookup (both callback forms, TLS path), the 1 MiB cap and timeout, manual redirects, 18 DOMPurify bypass payloads, nodemailer 10 through ESM and CJS, and re-read the 028 SQL. Everything in the "checked and holding" list of the plan was confirmed: no remaining user-client write to `organization_id`/`role`; onboarding survives the trigger; every user-URL fetch in `lib/actions` goes through the pinned path; `dangerouslySetInnerHTML` only in the inbox; every executor lead/account lookup org-scoped; every Apify run through `authorizeActors`.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | HIGH | Scheduled-send loop in the sequence executor loaded the sender account by id only; a direct PostgREST insert into `email_messages` with another tenant's `email_account_id` (the policy checks only `organization_id`) would send through that mailbox | Fixed in T14: account lookup filtered by `msg.organization_id`, message marked failed otherwise; 028 gains a `WITH CHECK` requiring `email_account_id` to belong to the caller's org |
| 2 | MEDIUM | Sanitizer kept `class` and `id`; Tailwind utilities in the built CSS allow a full-screen phishing overlay, `id` allows DOM clobbering | Fixed in T14: both forbidden; tests added |
| 3 | MEDIUM | AI/Apify keys remain readable by any org member through PostgREST (`GET /rest/v1/ai_settings?select=api_key`); legacy WhatsApp/LinkedIn tokens stay plaintext at rest until reconnected | Deferred, owner-visible: needs column-level `REVOKE SELECT` on the seven secret columns plus admin-client presence checks in `getAISettings` and the lead-finder settings route; risk of breaking the user-client selects that still read those columns. Intra-org exposure only. Rotate keys (owner action 3) |
| 4 | MEDIUM | SSRF through the tenant's `ollama_base_url` (`lib/lead-finder/ai-provider.ts:313-324` uses the string check; the OpenAI SDK resolves DNS and follows redirects; `updateAISettings` writes the URL unvalidated) | Deferred: needs a custom `fetch` on the OpenAI client through the pinned agent, or disabling the local-Ollama provider in production |
| 5 | LOW-MEDIUM | `launchCampaignRun` skipped the lead-ownership check when `audience_type` was `filter` but `audience_filters` was null and explicit ids were present | Fixed in T14: the check always runs on the final list |
| 6 | LOW | Sanitizer allowed relative and protocol-relative URLs, so an email could fire same-origin cookie-carrying GETs on open | Fixed in T14: only `https?:`, `mailto:`, `tel:`, `#` |
| 7 | LOW | IPv6 blocklist missed `::/96`, `ff00::/8`, `fec0::/10`, `2002::/16`, `64:ff9b:1::/48` | Fixed in T14 with test rows |
| 8 | LOW | 028 policies for `campaign_leads` and `automation_executions` check the parent row's org but not `lead_id` (stats-only impact) | Deferred |
| 9 | LOW | `connections.ts` caught the `getOrgId` redirect inside `try` and returned `{ error: "NEXT_REDIRECT" }` | Fixed in T14 with `unstable_rethrow`. Also noted, accepted: cleared number inputs in sequence settings now fail with a generic message; AI keys not clearable from Settings (A8) |
| 10 | LOW | Tests cover the pure functions, not the guard wiring in actions or the 028 SQL; `PublicAISettings` still declares three secret columns that are stripped at runtime | Deferred |

Final gates on `98f86f3`: `npx tsc --noEmit` 0 errors; `npm run lint` 0 errors (175 warnings); `npm test` 261/261 across 13 files; `npm run build` ok; `npm audit --omit=dev` 0 findings at every severity.
