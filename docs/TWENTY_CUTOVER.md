# Twenty + LLMsRelay controlled cutover

This integration runs AI and sales workflow preparation in Pulse. Twenty stays the CRM database. It never invokes native AI agents, native workflow execution, or installed `app_*` actions. Ordinary database writes can still trigger those native engines; the write gate therefore remains off until the audit below is complete.

## Prepare a reviewable deployment

1. Use Node 22. Run the type check, lint, full tests, and production build. Preserve the pre-existing `lib/ai/tools/labels.ts` edit.
2. Review additive migrations `045_twenty_connections.sql`, `046_copilot_twenty_sources.sql`, and `047_twenty_workflows.sql`. Run the isolated PostgreSQL migration tests and verify the deployed prerequisite schema before applying them for the manual read/draft pilot. Use an isolated Twenty workspace for runtime write and trigger acceptance before enabling writes. No application migration is applied by the cron endpoints.
3. Preserve the **original** production `ENCRYPTION_KEY`: existing encrypted keys may depend on it. Secure comparison on 2026-10-11 confirmed that the supplied local key exactly matches production; no rotation is needed. Never place it in a commit or document.
4. Configure a GPT/Codex LLMsRelay key through the existing AI settings, or the deployment's `CUSTOM_AI_BASE_URL=https://api.llmsrelay.com`, `CUSTOM_AI_API_KEY`, `CUSTOM_AI_MODEL`, and `CUSTOM_AI_FAST_MODEL`. Select GPT model IDs returned by that key's authenticated model catalog. Both models are required; Twenty requests never fall back to another provider. Catalog verification does not run inference. The selected pair is main `gpt-6.1-sol` and fast `gpt-5.6-sol`.
   GPT requests use Bearer authentication at `/v1/chat/completions`, with `stream=false` and retries disabled. A scoped adapter preserves the existing tool/approval loop and converts tool calls/results without invoking `/v1/messages` on the gateway. It also handles Relay GPT models on Pulse's shared custom-provider paths; other custom endpoints keep their existing protocol. Completion-token accounting includes reasoning tokens once. Malformed or unsupported responses stop execution; missing usage retains the full reservation.
5. An owner/admin connects `https://orbix-sales.twenty.com` with a workspace API key in Settings → Integrations. Verify the workspace identity, safe sales reads, and conditional update inputs against the deployed GraphQL schema. A schema check verifies capability; it does not prove the server's runtime CAS behavior. Prove that in staging with stale/current timestamps before enabling production writes.
   The pilot connection stays bound to that workspace URL and identity. Reverification or key replacement is supported for the same workspace; changing workspaces requires a separate integration design that retains the old history binding.
6. Keep `writes_enabled=false`, Pulse's sales schedules disabled, and the monthly token cap unset. Manual Copilot requests can prepare local drafts and proposals. Resolve the native workflow and installed-app overlaps below before enabling CRM changes or email sends; pausing the three native workflows alone is insufficient.

## Audit and pause overlapping native triggers

Read-only inspection on **2026-10-11** confirmed workspace `32fb59d2-2c0f-484a-af88-1fdc4b0e30fe`, subdomain `orbix-sales`, using `currentWorkspace` at `/metadata`. `list_workflows` returned exactly three workflows, all ACTIVE, with `totalCount=3` and `hasNextPage=false`. Their current versions remain unchanged from the earlier inspection. Re-read the live versions immediately before any pause.

| Workflow | Core workflow ID | Inspected active version | Replacement |
| --- | --- | --- | --- |
| Notify when mailbox is ready for outreach | `a9cdde46-375d-449c-a17d-a2c51039d129` | `7f93974a-83db-41a5-925d-fa9e08af4264` | Mailbox readiness transition → notification approval |
| Create company when adding a new person | `aa273389-5a77-5953-bc2a-41458d41e294` | `0aa98497-d9c3-5d00-88fc-ec484999e863` | Business-domain matching → company/person change approval |
| Quick Lead | `9c236527-4289-55d5-9f5d-ca8de68e649e` | `6e7a2f0c-4254-55ec-8fd7-ecaadf387f48` | Pulse Quick Lead form → reviewed creation bundle |

The mailbox workflow listens to `mailbox.updated` with status ACTIVE, health score at least 90, and spam placement rate at most 0.1; its downstream action sends an email. The company workflow listens to `person.upserted` on `emails`, excludes EMAIL/CALENDAR creator sources, then checks personal domains, finds or creates a company, and updates the person's `companyId`. Quick Lead is a global manual form that creates a company and person. The two creation workflows contain invalid legacy steps; that is not evidence that their ACTIVE triggers cannot execute. Pause a version with `deactivate_workflow_version({coreWorkflowVersionId})`; rollback uses `activate_workflow_version` with the same recorded version. No version was paused by this audit.

### Installed applications and handler inventory

`findManyApplications` returned these seven installed applications. Separate `isApplicationStopped` queries returned **false for every application**. No credentials or application-variable values were requested.

| Application | Installed application ID | Universal identifier | Version |
| --- | --- | --- | --- |
| Exa | `ddb99f99-c815-4b94-aaad-450167184902` | `2b7f4a2e-9c4b-4a11-b63c-2e5e7d3f5a9a` | `0.2.0` |
| Standard | `c40793ba-8102-416e-94bb-b0fab05ad2a5` | `20202020-64aa-4b6f-b003-9c74b97cee20` | `1.0.1` |
| Pulse GTM | `a776ca38-5cd7-47bc-9a29-b784e98be238` | `6da5917f-80bf-43b8-bb80-754b24a81435` | `0.1.0` |
| Claude | `52e21440-42bf-48c5-b4cd-8d06020899da` | `a3a5e535-4ffe-466f-8cc1-b71a6513086c` | `1.0.0` |
| Custom | `38f48d0f-53db-4c76-ba2c-c62fd6a352be` | `38f48d0f-53db-4c76-ba2c-c62fd6a352be` | `1.0.1` |
| ChatGPT | `62d99c5f-adab-4e06-8c6e-6d1ead5ca82c` | `bac24eb9-493d-40a3-8fe7-9a3a983591e5` | `1.0.0` |
| ChatGPT | `f0e28728-6071-4ca2-90c2-4cfb350476d0` | `629f11dc-6840-43a0-90a2-57c6b2bba264` | `1.0.0` |

The unpaginated `findManyLogicFunctions` query returned **48 functions**: 44 owned by Pulse GTM, three Custom workflow code functions, and one Exa tool. All **11 database-event handlers** and **12 cron handlers** below belong to Pulse GTM and report execution mode LIVE. One function has both an event and cron trigger. `list_webhooks` returned zero registered outgoing webhooks. The connector's `list_logic_function_tools` returned an empty workflow-action list; that result does not imply the absence of installed database-event functions.

The behavior column records the deployed function descriptions, not verified source code or runtime outcomes. App/workspace ownership is known; the API did not expose a responsible human owner or complete implementation guards.

| Database-event handler | Logic function ID | Event and registered field filter | Described downstream behavior |
| --- | --- | --- | --- |
| rescore-on-person-created | `f68e367f-43a1-4089-94bc-8e335921f59c` | `person.created` | Scores a new person against active ICP profiles. |
| rescore-on-person-updated | `3b31f02c-f7b5-4935-a9a1-4fc616afc13b` | `person.updated`; `jobTitle`, `location`, `companyId` | Updates lead score and ICP grade; score-only writes do not retrigger it. |
| draft-proposal-on-stage | `758e53b4-8cd2-48f3-8fbc-665e31eb019b` | `opportunity.updated`; `stage` | Drafts a proposal when the deal enters Proposal. |
| kickoff-won-deal | `c5254b10-d05f-4405-86c3-20f40476e0f3` | `opportunity.updated`; `stage` | Creates projects/tasks, marks the contact a customer, and drafts a deposit invoice and welcome email for a won deal. |
| triage-reply | `1c7894f7-d4bb-446f-82f0-38fa2257ef42` | `inboxItem.created` | AI reply classification/draft and deal, task, lead-status, or sequence follow-up. |
| send-approved-client-email | `49844439-f6f1-464e-9881-17b8b0ee748a` | `clientEmail.updated`; `status` | Sends a client email when approved. |
| send-client-email | `bc4cc952-747b-4e42-846a-a63f03079cd7` | `clientEmail.created`; also scheduled | Sends created-as-Approved emails and retries approved emails missed by a trigger. |
| detect-sequence-replies | `c913aed9-32a5-4745-aaeb-8e34b51416d7` | `messageParticipant.created` | Marks synced inbound emails from enrolled people as sequence replies. Sender/inbound guards require source verification before email activation. |
| detect-booked-meetings | `ced375ed-61a2-482b-801c-b2ccb5b0857f` | `calendarEventParticipant.created` | Moves a lead's deal to Meeting when added to an upcoming event. |
| project-delivered | `6fc10775-507a-41eb-9226-064674dc9029` | `clientProject.updated`; `status` | Records delivery date and drafts an upsell email. |
| send-invoice | `9cc1ef8b-1cb2-41b0-9fd1-51e6b7fc9c2c` | `clientInvoice.updated`; `status` | Creates an approved Stripe invoice; Stripe emails the client a payment link. |

| Scheduled handler | Logic function ID | Registered cron pattern | Described behavior |
| --- | --- | --- | --- |
| qualify-leads | `9c343201-cce3-4302-8972-86b816b5120f` | `*/5 * * * *` | Website/AI qualification, email verification, suppression checks, and person scoring/status writes. |
| send-sequence-steps | `46f8c36d-2875-482b-afc0-424371fc8bbc` | `*/15 * * * *` | Sends due sequence emails/tasks and schedules subsequent steps. |
| send-client-email | `bc4cc952-747b-4e42-846a-a63f03079cd7` | `*/15 * * * *` | Sends/retries approved client emails. |
| enrich-website-visitors | `0b2885f2-f190-46d5-a312-00f74a420e3f` | `*/10 * * * *` | Identifies visitor companies, creates Prospeo leads, and enrolls them in the website-visitors sequence. |
| sync-mailbox-inboxes | `fa6b4305-dddf-42ee-96a7-351ef047b6c8` | `*/10 * * * *` | Copies mailbox messages into Inbox and marks sequence replies. |
| run-warmup | `9152b627-ca29-4801-8925-3cd230a73a87` | `*/20 * * * *` | Sends warmup emails between workspace mailboxes. |
| process-warmup-inboxes | `b80731cc-11f0-4193-8ae5-067e7157aee1` | `10,40 * * * *` | Rescues warmup mail from spam, marks it important, replies, and updates mailbox health. |
| reset-mailbox-daily-counters | `2ac128ac-7b1e-43d4-a373-3e40b949760a` | `5 0 * * *` | Resets send counters and advances the warmup ramp. |
| invoice-reminders | `472314ad-f974-4b8b-b171-d3c6e4140b09` | `0 * * * *` | Synchronizes Stripe invoice state and drafts payment reminders. |
| renewals | `ba704341-8a62-4db4-abd6-3f8a5dc9efd1` | `0 10 * * *` | Drafts renewal, referral, and missed-upsell emails. |
| proposal-follow-ups | `fa04b610-cc54-4811-a693-71927951c4fd` | `0 9 * * *` | Drafts follow-ups for unanswered proposals. |
| weekly-client-updates | `855cfe68-98fa-4c9a-8f10-be86958711d9` | `0 8 * * 1` | Updates project-health flags, creates attention tasks, and drafts weekly status emails. |

These patterns are stored scheduler expressions; the audit did not establish their configured timezone or actual execution entitlement. A provider change alone cannot disable native app/workflow metering. No direct database-event registration was found for company, task, note, or proposal, but that does not establish the absence of indirect effects or scheduled consumers.

### Unresolved pause and coverage requirements

The exact native workflow pause candidates are the three version IDs above. For Pulse writes, additional overlap candidates include person creation and company-link rescoring, opportunity stage automation, Inbox creation/AI triage, client-email delivery, and mailbox/message reply handling. Scheduled qualification can independently consume changed leads, and scheduled email senders can deliver records created or modified by other handlers. The financial and client-project handlers are outside this pilot's write scope; they have no Pulse replacement here.

Pulse can replace scoring/qualification, local proposal/reply drafts, and approved email sends through its existing tools. It does not replace the app's entire agency kickoff, Stripe billing, sequence delivery, visitor enrichment, or warmup system. Do not stop the entire Pulse GTM app as a substitute for targeted resolution without reviewing those consequences and a supported rollback.

Source inspection of a Pulse GTM handler through `getLogicFunctionSourceCode` returned FORBIDDEN: "Only logic functions written in this workspace can be read or changed from source". `exportApplication` reported all 44 Pulse GTM logic functions UNSUPPORTED and returned no source files. The deployed metadata mutation schema exposed no app stop/restart mutation or per-handler disable input; `UpdateApplicationInput` only contained `autoUpgrade`. Therefore source guards, a targeted pause mechanism, and its rollback remain unverified. Obtain the app maintainer's source/access or a supported management mechanism before resolving these entries as paused or non-overlapping.

For each handler, record an explicit resolution: pause within the approved cutover scope, or demonstrate that it does not overlap the allowed operation/object. Include evidence, the responsible operator, and the rollback action. The owner approved production cutover, but that approval does not establish missing source/runtime evidence or authorize silently disabling unrelated agency/billing systems. If an overlapping trigger cannot be verified and resolved, keep affected objects outside `cutover_audit.coveredObjects` and writes disabled. **The 2026-10-11 audit made no trigger changes or CRM writes and does not satisfy the write-activation gate.** A read-only/manual-drafting deployment remains possible while these requirements are outstanding.

Do not automatically port invalid legacy workflow steps. Implement their intended behavior using validated API fields. The company-link replacement skips personal domains, existing company links, and EMAIL/CALENDAR source events. Missing system-source fields must be treated as unsupported for this workflow during acceptance verification.

## Acceptance and activation

- Check guest/member denial, role revocation, tenant isolation, connection replacement, source-separated conversations/memory/artifacts, and secret redaction.
- In staging, confirm that stale CAS updates change zero records and current-version updates change exactly one. Require exactly one returned record; never degrade to read-then-unconditional-update.
- Test Quick Lead duplicates, existing company matching, partial create failure, timed-out creates, and unknown email sends. An uncertain create/send is not retried; reconcile the external state before preparing a fresh approval.
- Test person business-domain changes, personal emails, EMAIL/CALENDAR sources, already linked companies, mailbox readiness thresholds, repeated ready observations, and a ready→not-ready→ready transition. Each external write/send must show its complete immutable approval.
- Test polling pagination, inclusive timestamp checkpoints, replay dedupe, stale leases, expired AI attempts, retries, role revocation immediately before inference, and token-cap exhaustion. First activation initializes a baseline and does not enroll old leads. Mailbox baseline records current readiness without producing historical notifications.
- Use representative approved staging writes for each enabled object and confirm that no native AI, app, email, or workflow side effect fires unexpectedly. Record the tested objects, operator, timestamp, reviewed trigger inventory, and evidence in the cutover audit. The activation action requires `coverageEvidence`, a resolution/evidence entry for each `nativeTriggers` item, `verifiedNoUnexpectedEffects`, and `conditionalUpdateEvidence` containing the probe `recordId`, `returnedOne=true`, `staleRejected=true`, and explanatory evidence. A schema check alone is insufficient.
- After deployment/migrations/trigger pause approval and successful verification, enable writes only for tested objects. Start with manual owner/admin requests. Then configure a positive monthly token cap and enable selected schedules deliberately.

## Scheduling and operation

The existing GitHub Actions `crm-cron` calls `/api/cron/twenty-poll` and `/api/cron/twenty-worker` every five minutes using `CRON_SECRET`. GitHub scheduling can be delayed. Polling is bounded to a page per workflow; the worker claims one job per invocation. It uses no background work after the HTTP response. The two endpoints never run remote CRM mutations or email sends; they prepare approvals only. Mailbox monitoring starts after its initial readiness snapshot completes; readiness changes during that initialization may be absorbed into the baseline. Lead workflows store their activation timestamp before the first cron call, so future lead changes do not depend on the scheduler starting immediately.

Scheduled qualification reads active Twenty ICP profiles only and stops if their catalog exceeds 25 profiles or the prompt exceeds 20 KB. Such jobs require a manual Copilot analysis rather than silently dropping context. This pilot intentionally limits throughput and input size while preserving reviewability.

Supabase stores workflows, checkpoints, durable jobs, attempts, audit events, and monthly usage. Service-only RPCs fence job leases, atomically stage approval rows, and reserve tokens before inference. Attempts without trustworthy usage keep their full reservation charged; expired metered attempts become `unknown_outcome` and are not automatically replayed. Responses with trustworthy usage settle actual tokens once, including a metered response whose output is unusable. An inference budget is a token cap, not a currency guarantee.

Quick Lead and company creation reserve normalized email/domain keys across approvals. A completed or uncertain reservation is retained without automatic expiry. Reconcile external records and the reservation audit before another creation; retries must never release an uncertain fence. Scheduled proposals retain their original record version, including mailbox readiness, and become stale if that premise changes before approval execution.

Monitor Recent jobs and pending approvals. Resolve `unknown_outcome`, `partial`, and `stale` jobs by reviewing audit/external state and preparing a new proposal when appropriate. Pause workflows and lock writes before investigating unexpected native effects. Revoking/replacing the connection invalidates old approvals. Rollback the app independently of data migration; keep durable approval/audit records for reconciliation.

Production deployment, database migrations, native trigger changes, live inference, and live email sends were not performed as part of code preparation.

## Local verification completed

Verified on 2026-10-11:

- Full Vitest suite after the GPT adaptation: **101 files, 1,482 tests passed** (inspected baseline: 1,260 tests).
- TypeScript checks and the production Next.js Webpack build (`npm run build -- --webpack`) passed. The default Turbopack build encountered a local PostCSS subprocess/IPC startup failure, including outside the sandbox; this remains a local build limitation. The existing instrumentation hook now wraps its worker import in a positive Node.js runtime branch, preserving behavior and allowing Edge compilation to exclude Node-only imports. These local checks used the installed Node 24 runtime; use the project's Node 22 engine during staging acceptance.
- ESLint: zero errors; the same 154 existing warnings remain.
- Vercel configuration check and `git diff --check` passed.
- Independent backend, queue/migration and React reviews completed; reported findings were corrected and regression-tested. GPT review additionally checked tool-choice constraints, denied/approved tool continuation, malformed responses, sanitized Pulse fallback classification, and isolation from unrelated OpenAI organization/project headers.
- The pre-existing `lib/ai/tools/labels.ts` change was preserved.

Tests use local PostgreSQL/PGlite and mocked remote providers/actions. They do not establish live API entitlement, deployed conditional-update behavior, or the absence of native trigger side effects. Those staging and workspace checks, original encryption-key recovery, and secure credential setup remain required before activation.

## Credential setup progress

- The supplied `ENCRYPTION_KEY` is configured only in the Git-ignored local environment file; an encryption/decryption round trip passed. Existing production credential decryption has not been tested.
- The supplied Twenty key passed read-only adapter verification against `https://orbix-sales.twenty.com`: workspace identity matched, People and Companies reads succeeded, and all 16 allowlisted sales objects were present. The deployed schema exposes ID/version conditional-update inputs; runtime write behavior remains untested.
- The key is staged locally. No connection row was saved to production, no production migration was applied, and no CRM mutation or email send occurred.
- The supplied LLMsRelay key and API URL are staged in the Git-ignored local environment file. An authenticated, read-only `/v1/models` request returned HTTP 200 with `gpt-5.6-sol`, `gpt-6-sol`, `gpt-6.1-sol`, and `gpt-6-astra`. No inference request was made.
- The owner selected GPT and the pair main `gpt-6.1-sol` / fast `gpt-5.6-sol`. Both IDs are configured locally and passed the integration's authenticated catalog validator using Bearer authentication. [LLMsRelay's Codex documentation](https://llmsrelay.com/docs/api-reference/codex/) specifies the OpenAI transport for this key group. The integration has been adapted accordingly; no paid inference or production configuration was performed during preparation.
