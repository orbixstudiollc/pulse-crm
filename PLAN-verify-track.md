# Plan: Email Verification + real Website Visitors tracking

Produced by an adversarial planning run (Astra = shipping speed, Fable = correctness), 2 rounds, round 3 not needed. Executor handoff: `tasks-verify-track.json` (20 tasks, 8 waves; run with the `astra-fable-execute` skill).

## Approach

- **One budget for both paid services.** Migration 039 generalizes the AI budget (038) into a service-keyed counter, `shared_usage_budget` with `reserve_shared_units` / `settle_shared_units`. Both MillionVerifier (email) and IPinfo (company lookup) charge it before every call.
  - Caps apply per workspace, to a guest pool and site-wide, and the check fails closed.
  - A unit is refunded only when the provider call provably never left the server. Timeouts and lost responses stay charged, so the caps bound the real invoice.
- **Email verification** has two layers:
  - **Free checks inside Pulse:** syntax, MX with an A-record fallback, the maintained `disposable-email-domains` list, role addresses, free providers and typo suggestions.
  - **Paid check:** a MillionVerifier step for mailbox and catch-all.

  Results:
  - **Caching:** per workspace and email, for 30 days ("unknown" results for 1 day).
  - **Storage:** written to leads and contacts only if the record's email still matches.
  - **Bulk jobs:** a job table plus per-item rows, claimed in chunks by a loop in the browser using `FOR UPDATE SKIP LOCKED` and an attempt fence. This is resumable with visible progress and needs no scheduler.
  - **CSV export:** neutralizes spreadsheet formulas.
- **Tracking v2:**
  - **Script:** a hosted, cacheable `/api/tracking/t.js`.
  - **Visitors and sessions:** a first-party visitor id, 30-minute sessions shared across tabs, and per-event ids.
  - **Ingest:** one SECURITY DEFINER `track_event` RPC deduplicates events and upserts visitor, session and pageview atomically, clamping engaged time.
  - **Company lookup:** IPinfo runs in `after()` against a global cache keyed by an HMAC of the IP. Only business-type results are shown as companies; ISP and hosting results never are.
  - **Server-side events:** `POST /api/tracking/events` authenticates with a new `tracking` scope on the existing `api_keys` (migration 036).
  - **Legacy rows:** existing visitor rows stay as they are, labelled "legacy".
  - **Retention:** the daily cron purges raw data after 90 days and builds daily rollups.

## Tasks (dependency order)

| Wave | Tasks |
|---|---|
| 1 | **T1** migration 039 + PGlite migration test harness (opus) · **T13** tracking pure modules (sonnet) |
| 2 | **T2** budget code (opus) · **T3** in-house email core (sonnet) · **T6** migration 040 email tables + claim RPC (opus) · **T7** migration 041 tracking v2 (opus) · **T14** hosted tracker script (opus) |
| 3 | **T4** MillionVerifier adapter (sonnet) · **T8** `types/database.ts` (sonnet) |
| 4 | **T5** verification orchestrator (opus) · **T12** sequence opt-in policy (sonnet) · **T15** IPinfo + async enrichment (opus) · **T19** daily cron retention/rollups/purges (sonnet) |
| 5 | **T9** verification server actions + bulk jobs (opus) · **T16** ingest core + `/api/tracking` rewrite (opus) |
| 6 | **T10** Email Verifier page (sonnet) · **T17** server-side events API (opus) · **T18** Website Visitors page on the new model (opus) |
| 7 | **T11** badges / Verify actions on leads & contacts, snapshot reset on email edit (opus) |
| 8 | **T20** full gate + env docs + owner apply order (sonnet) |

Full interfaces and verify commands are in `tasks-verify-track.json`.

## Rulings in synthesis

1. **Testing the SQL (disagreement both sides raised).**
   - Astra: a real Postgres (`TEST_DATABASE_URL`) and a Playwright suite.
   - Fable: static SQL lint plus mocked RPC tests only.
   - Fact check: there is no Docker, no `supabase/config.toml` and no test database, and the repo only has vitest, so Astra's harness can't run here. Fable's version never executes the SQL.
   - **Ruling:** PGlite, real Postgres compiled to WASM and run in-process as a devDependency. Each new migration runs twice against a minimal schema stub, and tests call the RPCs as `service_role` and as tenants. This is how 035 and 038 were verified this week.
   - Concurrency can't be exercised in one PGlite connection, so the lock order is documented in each migration header.
2. **Disposable address** → `risky`, never `invalid`. **Transient DNS failure** → `unknown`, never `invalid`. These are correctness fixes, and a wrong "invalid" can't be undone once a sequence suppresses the address.
3. **Model routing.** T11, T14, T17 and T18 moved to opus: they cover the cross-tab session logic, an auth scope change on API keys, record writes guarded by the current email, and the page reworked onto the new model.
4. **Package conflict.** T3 now depends on T1, because both edit `package.json` and `package-lock.json`.

## Open risks

- **Distinct visitors over long ranges.**
  - Astra: keep per-visitor daily membership so distinct counts stay exact beyond 90 days.
  - Fable: the page only asks about today, 7 days and 30 days, all inside the 90-day raw window, and keeping pseudonymous ids for 2 years contradicts the retention goal.
  - **Chosen:** Fable's (scalar daily rollups beyond 90 days).
  - Settles it: whether you ever want "unique visitors this year". If so, add a rollup table later.
- **Lowercasing the whole address for the cache key** (Astra: local parts can be case-sensitive). Chosen: lowercase the cache key and store the original casing on the record. Almost no real mailboxes are case-sensitive.
  - Settles it: a provider result that differs by case on a real address.
- **Provider plan fields.** IPinfo's company type is a paid-tier field. On a lower plan every lookup is spent and no company is ever shown.
  - Mitigation: unknown fields map to "no company"; the README states the plan requirement; the live walkthrough checks it.
- **Hand-applied SQL.** PGlite catches syntax and semantic errors but not production drift.
  - Mitigation: each migration header ends with a "smoke after apply" block of 3–5 SELECT/RPC calls you run once.
- **`after()` enrichment cut off.** If Vercel ends the function first, the unit stays charged (by design), and the next event from that visitor retries. Caps bound the worst case.
- **A large bulk job runs past the daily paid cap.** The rest of the job gets free-check-only results.
  - Mitigation: the Bulk tab shows the remaining paid allowance before Start, and each row in the CSV carries its reason.
- **Abuse of the public tracking endpoint (CORS `*`).**
  - Defences: domain match on the page URL, bot filter, token bucket per script, clamped engagement, event-id dedupe, and capped IP lookups.
  - Domain matching reduces misuse; it is not authentication.

## Rejected alternatives (short)

- **Own SMTP probing from Vercel:** port 25 isn't reliable there.
- **A scheduler (minute cron, pg_cron, QStash) or chained `after()`:** Hobby crons run daily only, and chained calls show no progress and can double-process. The browser-driven loop is used instead.
- **Copying 038's RPCs for each service:** one service-keyed pair is easier to audit.
- **Refunding on every provider error:** it would undercount real spend.
- **Per-workspace IP cache:** pays again for every shared IP. The cache is service-role-only, so a global one loses no isolation.
- **Merging legacy visitor rows:** risky SQL to protect demo data.
- **Plain SHA-256 or keeping raw IPs:** unsalted IPv4 hashes can be brute-forced; HMAC with a server secret is used instead.
- **Keeping the inline snippet as the main install method:** it can't be updated after it's pasted.
- **Keeping ipapi.co's org field as the company:** it's the ISP.
- **A second credential store for server events:** `api_keys` already has hashing, revocation and a UI.
- **Edge runtime for tracking:** needs `after()`, the Node admin client and node:crypto.
- **Default-on sequence skip:** the brief says opt-in.

## Owner actions

1. **Run migrations 039, 040 and 041 in order** in the Supabase SQL editor, then the smoke block at the end of each header.
2. **Vercel, Production.** Never paste these values in chat:
   - `MILLIONVERIFIER_API_KEY`
   - `IPINFO_TOKEN`, on a plan that includes the company field
   - `TRACKING_IP_HASH_SECRET`, a random string of 32 or more bytes
   - optional caps: `EMAIL_VERIFY_ORG_DAILY_LIMIT` (default 200), `EMAIL_VERIFY_DAILY_LIMIT` (2000), `EMAIL_VERIFY_GUEST_DAILY_LIMIT`, `IP_LOOKUP_ORG_DAILY_LIMIT` (300), `IP_LOOKUP_DAILY_LIMIT` (3000), `IP_LOOKUP_GUEST_DAILY_LIMIT`. Plain digits only; a malformed value turns that service off.
3. **Live walkthrough after deploy.** Verify one email and a bulk list, install `t.js` on a test page, and check that visitors, sessions and companies appear.
