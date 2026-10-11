# LLMsRelay GPT production operations

This runbook records the read-only preflight on 2026-10-11 and the concrete deployment sequence. The user approved paid smoke testing and production cutover. The commands below have not been executed by the preflight agent. Apply the database and workspace acceptance gates in [TWENTY_CUTOVER.md](TWENTY_CUTOVER.md) before activating external writes.

## Verified target and access

| Item | Verified result |
| --- | --- |
| Vercel project | `orbix2/pulse-crm`, `prj_berulyYcwWdFDUzBDMqeKBA5669k` |
| Team | `team_iHxNm8CkJ9KoHuKDcVGQI8Ze` |
| Production alias | `https://pulse-crm-weld.vercel.app` |
| Existing production deployment | `dpl_4KaaiCmD5sHCzss35BByGryo8LSt`, `https://pulse-plufu1zzf-orbix2.vercel.app`, Ready |
| Existing build configuration | Next.js; `buildCommand=null` (automatic); project Node `24.x` |
| Required package runtime | `engines.node="22.x"` |
| Production encryption key | Exactly matches the supplied local key; preserve the existing production variable |
| Supabase | Local URL and service-role key match production, project ref `gwfktpaczpzigfbzrngj` |
| Migration presence | Twenty tables and source/connection columns are absent; 045–047 remain required |
| Staging isolation | Existing Preview and Production share the same Supabase variable entry; these previews are not isolated database staging |
| GitHub | Repository `orbixstudiollc/pulse-crm`; main branch; authenticated repository/workflow access; `crm-cron` active; `CRON_SECRET` exists |

The Vercel CLI is authenticated. Its existing auth file can be read in memory at `%APPDATA%/com.vercel.cli/Data/auth.json`; never print it or copy its token into command arguments. The Supabase service-role key permits REST operations but does not permit SQL DDL. Preflight found no database connection credential, management access token, or SQL execution RPC. Use an authenticated Supabase SQL Editor, management API token, or database connection for migrations and staging preparation.

## Approved rollout record, 2026-10-11

- The Supabase connector became available. Live prerequisite inspection confirmed migrations 042–044 and no partial Twenty migration. All 22 isolated migration tests passed. Applied 045, 046, and 047 sequentially with transaction-local lock timeout 5 seconds and statement timeout 60 seconds; all succeeded. Migration ledger entries: `20261011082415`, `20261011082423`, `20261011082430`.
- Production checks verified RLS on all ten new tables, private credential/queue/budget access denial for browser roles, service-role RPC grants, validated tenant foreign keys, immutable binding triggers, and preserved existing ownership policies. Existing Pulse counts and source bindings were unchanged.
- Saved connection `a7698573-4bd5-4eae-ac6d-91d719201ab6` for the verified non-guest Orbix Studio LLC administrator. Workspace identity and all 16 sales-object schema capabilities were verified; encrypted credential roundtrip succeeded. Revision 1; writes false; no scheduled workflows; monthly cap null. Runtime CAS is unproven and write activation remains blocked by the installed-app audit.
- Six bounded paid synthetic requests used 26,864 provider-reported tokens in total. Fast text and main tool-call/result roundtrip passed; no retries, fallback calls, CRM mutations, or sends. Two pre-fix tool responses were rejected. A captured response exposed omitted optional assistant content; the narrow compatibility fix permits that field to be absent while retaining malformed-response guards. All 41 adapter tests passed after the fix.
- Release checks passed: 101 test files, 1,485 tests, TypeScript, lint (zero errors, 154 existing warnings), Webpack production build, Vercel configuration, and whitespace checks. The pre-existing `labels.ts` addition remains intact.
- Updated only the four approved production Relay variables and Node 22/Webpack settings. The original encryption key and database credentials were preserved. Initial candidate `dpl_8ER7CvprkgXJ5847D7RN9ToEPNc4` / `https://pulse-dmgjvl2tc-orbix2.vercel.app` built successfully. Its upload excludes local environment and credential files.
- The owner approved enabling normal production sign-in for the pilot, replacing the existing public demo entry behavior. Set `NEXT_PUBLIC_OPEN_ACCESS=false` for the final deployment. Existing guest access to Twenty remains denied.

The final production deployment and endpoint checks are recorded after completion. The three native workflows and installed Pulse GTM app remain unchanged; no affected writes or sends are enabled. See the exact overlap inventory in [TWENTY_CUTOVER.md](TWENTY_CUTOVER.md).

## Configure only the reviewed production variables

Use the Git-ignored `.env.local` as the input source for the four `CUSTOM_AI_*` variables:

| Variable | Expected value |
| --- | --- |
| `CUSTOM_AI_BASE_URL` | `https://api.llmsrelay.com` |
| `CUSTOM_AI_API_KEY` | Supplied key, loaded only in memory |
| `CUSTOM_AI_MODEL` | `gpt-6.1-sol` |
| `CUSTOM_AI_FAST_MODEL` | `gpt-5.6-sol` |

Do not upload the whole local environment file. Its app URL is stale and other variables are outside this cutover. Preserve production `ENCRYPTION_KEY`, database credentials, `CRON_SECRET`, OAuth settings, and shared budget settings.

For each of the four variables, the supported mutation is:

```text
POST https://api.vercel.com/v10/projects/prj_berulyYcwWdFDUzBDMqeKBA5669k/env?upsert=true&teamId=team_iHxNm8CkJ9KoHuKDcVGQI8Ze
Authorization: Bearer <existing CLI token loaded in memory>
Content-Type: application/json
```

The JSON body is `{key, value, type, target:["production"]}`. Preserve the existing `type:"sensitive"` for the API key and URL; use `type:"encrypted"` for the new model IDs. [Vercel supports upserting existing variables](https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables) and [sensitive values cannot be read back](https://vercel.com/docs/environment-variables/sensitive-environment-variables). Capture only HTTP status, variable name, configuration ID, and failure codes. Inspect a response's `failed` array even when its HTTP status succeeds; never serialize raw API responses, which may contain values.

Keep updates sequential. Re-list variable names/targets afterward. Verify the deployed key with an authenticated model-catalog request through the application transport; do not infer success from the variable name alone. Environment changes apply to the next deployment.

## Build and create the production candidate

`package.json` already pins Node `22.x`, which [overrides the project Node setting](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Verify that the build log reports Node 22. The build command can be set through the [project update API](https://vercel.com/docs/rest-api/projects/update-an-existing-project):

```text
PATCH https://api.vercel.com/v9/projects/prj_berulyYcwWdFDUzBDMqeKBA5669k?teamId=team_iHxNm8CkJ9KoHuKDcVGQI8Ze
body: {"nodeVersion":"22.x","buildCommand":"npm run build -- --webpack"}
```

This aligns the project setting with its engine and selects the verified Webpack build. Record the previous `nodeVersion:"24.x"` and `buildCommand:null` for configuration rollback. A `buildCommand` in `vercel.json` can alternatively override the project command for a deployment; preserve all existing regions, cron entries, and function limits if using that option. [Vercel build-command configuration](https://vercel.com/docs/project-configuration/vercel-json).

Run from the linked repository root after migrations and prerequisite checks:

```powershell
vercel deploy --prod --skip-domain --yes --scope orbix2
```

This uploads the reviewed local checkout and builds with production environment variables. [The `--skip-domain` option prevents automatic alias promotion](https://vercel.com/docs/cli/deploy). It does not create database isolation: the candidate still uses production Supabase. Do not use it for staging mutation tests. Preserve the pre-existing `labels.ts` edit and ensure environment files remain excluded from upload.

Record the returned candidate URL/deployment ID and inspect it:

```powershell
vercel inspect <candidate-deployment-url> --scope orbix2
```

Require Ready status, Node 22 build evidence, successful catalog and scoped GPT smoke checks, owner/admin access checks, source separation, and the applied schema before promotion. Keep `writes_enabled=false`, workflow schedules disabled, and the monthly schedule cap unset until their separate acceptance evidence is complete. Calls to unauthenticated dashboard routes may create guest demo workspaces in the existing open-access application; use an authenticated owner session for application checks.

## Promote, schedule, and roll back

Promote the verified production candidate:

```powershell
vercel promote <candidate-deployment-url> --yes --scope orbix2
vercel promote status pulse-crm --scope orbix2
```

[Promotion moves production aliases to the selected deployment](https://vercel.com/docs/cli/promote). Re-check `https://pulse-crm-weld.vercel.app` using the owner session. The GitHub cron file already points at this alias. Its local Twenty endpoint additions must reach the default branch through a normal reviewed commit/push for the scheduled workflow to call them. Preserve `CRON_SECRET`; publishing the workflow does not authorize enabling paid schedules.

If the candidate fails after promotion, restore the prior deployment:

```powershell
vercel rollback dpl_4KaaiCmD5sHCzss35BByGryo8LSt --yes --scope orbix2
vercel rollback status pulse-crm --scope orbix2
```

[Rollback restores production traffic to a previous deployment](https://vercel.com/docs/cli/rollback). It does not undo Supabase migrations, CRM changes, emails, project configuration changes, or environment-variable changes. Preserve additive migration tables and approval/audit history. Disable workflows and lock writes before investigating uncertain external outcomes. Restore the recorded project settings separately if necessary; keep the original encryption key unchanged. An older Sensitive Relay key cannot be recovered through Vercel, so obtain it from the provider or secure key store before relying on an environment-level rollback.
