# Open-findings plan (2026-09-30)

Closes the four findings the 2026-09-29 follow-up review left open (see
`PLAN-followup.md`, "Open findings not fixed here"). Task list: `tasks-open.json`.

## Tasks

| Task | Model | Finding | Change |
|---|---|---|---|
| O1 | sonnet | L3 | `obsidian_vault_path` removed from the lead-finder settings API, page and writable-columns allowlist. The observer derives the vault from `OBSIDIAN_ALLOWED_ROOT/<orgId>`; the DB column stays. |
| O2 | sonnet | L4 | Accepted SMTP ports and TLS rule shown under both SMTP forms and in the send-time rejection string. |
| O3 | opus | L6 | Guest cleanup scans in pages (order by id, `.gt("id", cursor)`, `GUEST_CLEANUP_MAX_PAGES = 5`) so a block of skipped rows cannot stall it. Fake-client tests added. |
| O4 | opus | RLS | Migration `031_account_role_rls.sql`: per-command policies on `email_accounts`, `whatsapp_accounts`, `linkedin_accounts` (SELECT/UPDATE member; DELETE admin/owner; INSERT admin/owner). Gmail and Microsoft OAuth callbacks redirect non-admins with `error=forbidden`. |
| O5 | sonnet | gate | lint, vitest, `next build`, restyle scan, contrast, `npm audit`. |
| R1 | opus | review H1/L3 | `protect_email_account_credentials` BEFORE UPDATE trigger on `email_accounts` (credential/identity columns need admin/owner unless service_role or no JWT); `updateEmailAccount` admin-gated; whatsapp/linkedin INSERT made admin-only (the app inserts through the admin client, so no path changes). |
| R2 | sonnet | review M1/L4/L5 | TLS help text corrected (TLS mode comes from `secure`, not the port); custom-form default `smtp_secure` is now false for port 587; campaigns modal sends `secure: port === 465`; sender rejection string no longer describes TLS; settings page toasts `?error=` from the OAuth callbacks. |
| R3 | sonnet | review M2/L2 | `maxDuration = 300` on the daily-reset cron; OAuth start routes return 403 for non-admins before the consent screen; forbidden redirects land on the email-accounts tab. |

## Execution record (2026-09-30)

- **Waves:** 2 planned (O1–O4, then O5) plus one review-fix wave (R1–R3), then O5 again. 8 tasks, 8 passed on first verify. Models: opus x3, sonnet x5. No Sonnet→Opus escalation.
- **Commits:** 7 code commits (`5b35f40`..`ffaea20`), each one task, plus this record.
- **Scope:** 15 files changed across the range, all declared by their task. No drift.
- **Plan defects found in run:** R1's verify counted `requireRole(` call sites as 5 where 3 was right (the import and a `typeof` reference have no `(`). The executor stopped and reported instead of padding the code; the verify threshold was corrected in the plan. No executor work was edited by the orchestrator.
- **Judgment review (opus, adversarial, on O1–O4):** 0 critical, 1 high, 2 medium, 6 low.
  - H1 fixed (R1): 031's member-level UPDATE plus the ungated `updateEmailAccount` let any member point `smtp_config` at their own host and harvest the decrypted password on the next send.
  - M1 fixed (R2): the O2 help text claimed the port chose TLS; the code uses `smtp_config.secure`, and the settings form defaulted 587 + secure=true, which fails.
  - M2 fixed (R3): the cron could now make up to 5x more serial auth calls per run with no `maxDuration`.
  - L2, L3, L4, L5 fixed (R1–R3). L1 and L6 left open (below).
- **Final gate:** O5 passed after the review fixes (lint, 21 test files, production build, restyle scan, contrast, audit).

## Still open

- **L1** Guest cleanup starvation is bounded (1000 rows per run), not removed: the cursor restarts each run, so 1000+ permanently skipped rows sorting first by uuid would still shadow later guests. A persisted cursor or `order by created_at, id` would remove it.
- **L6** Migration 030 still grants `obsidian_vault_path` to `authenticated`; harmless, since nothing reads it. Drop the column or the grant in a later migration.
- **Pre-existing** The campaigns-page custom SMTP modal sends no username or password, so accounts created there cannot authenticate. Not introduced here.

## Owner actions at deploy

- Apply `supabase/migrations/030_followup.sql` and `supabase/migrations/031_account_role_rls.sql` in the Supabase SQL editor in the same session as the production deploy. Both are idempotent; 031 ends with verification queries.
- After 031, members can no longer connect, delete or re-authorise organization mail accounts, or change their stored credentials; admins and owners can. Guests are admins of their own workspace and are unaffected.
- `CRON_SECRET` GitHub repository secret and the optional `GUEST_*` Vercel variables from `PLAN-followup.md` still apply.
