# Plan: Copilot 2.0

This plan came from an adversarial planning run between two models: Astra argued for shipping speed, Fable for correctness. They debated for 2 rounds. Round 3 was replaced by checking the remaining disputes against the code; see "Rulings in synthesis".

- **Executor handoff:** `tasks-copilot2.json` (30 tasks, 12 waves; 14 run on Opus, 16 on Sonnet). Run it with the `astra-fable-execute` skill.
- **Brief:** session scratchpad `afp-copilot2/brief.md`.

## Approach

**The server is the only source of truth for what the AI acts on.**
- It stores every message part of every conversation.
- It rebuilds the model's history only from its own rows.
- The only things it accepts from the browser are:
  - a new user message;
  - approval responses, keyed by approval ids the server issued itself;
  - the ids of the records on screen.

**Every record write goes through one tool registry, shared with the MCP server.** Writes are on an explicit allowlist, and `delete_record` is never exposed. The registry:
1. Computes a diff over the exact column patch the handler will write.
2. Records a pending approval row before the approval card reaches the browser. Only the server can write that table.
3. At execution time, claims that row atomically, exactly once.
4. Writes only if the record's `updated_at` still matches the value it had when proposed, so a stale or replayed approval can never apply.

**Chat, the Approvals list and the nightly task runner share this one execution path.** Tenancy, the shared AI budget, the limit on writes per turn and the approval policy are therefore enforced in one place.

## Tasks (dependency order)

| Wave | Tasks |
|---|---|
| 1 | **T1** shared PGlite test helper · **T5** field diff · **T10** memory block with a token cap · **T20** schedule helpers · **T25** page starters and page map |
| 2 | **T2** migration 042: history, approvals, always-allow, turn lock · **T3** migration 043: artifacts, guidance limit, notifications, task columns · **T6** tool registry and adapter |
| 3 | **T4** `types/database.ts` |
| 4 | **T7** Copilot-only tools · **T8** approval store · **T15** settings actions |
| 5 | **T9** server-owned history · **T21** task runner |
| 6 | **T11** chat route rewrite · **T14** conversation, artifact and notification actions · **T22** daily-cron task runs · **T30** migration 044 (applied after the deploy) |
| 7 | **T12** client chat hook · **T16** resolve-approval and undo actions · **T24** notifications dropdown |
| 8 | **T13** step trace, approval card, undo |
| 9 | **T17** Copilot page, artifacts view, pending approvals · **T26** docked panel on Leads, Deals and Inbox |
| 10 | **T18** Memory 2.0 · **T19** Settings view · **T23** composer clock (recurring tasks) · **T27** remove the dead action path |
| 11 | **T28** acceptance test (10 adversarial scenarios) |
| 12 | **T29** full gate: tsc, eslint, tests, restyle, build |

## Rulings in synthesis

The skill calls for a round 3 because both sides raised the same disputes. Most of those disputes were questions of fact about the code, and neither planner could read the code. So I checked the code directly.

1. **Automations after a Copilot write.**
   - Fable: skip all automations. Astra: suppress only the ones that send something.
   - **Fact:** `lib/automation/runner.ts` has 7 action types. Only `enroll_sequence` leads to email; `send_notification` only logs an activity.
   - **Ruling:** Copilot writes run only an allowlist of actions with no outbound effect. Anything else, including `enroll_sequence` and any action type added later, is skipped and shown in the step trace.
2. **Guest recurring tasks.**
   - Fable round 1: none, because the purge removes guests. Astra: one task, one run a day.
   - **Fact:** guests are purged 7 days after they're created, not nightly.
   - **Ruling:** guests get one active task and one run a day. Tasks run before the purge step in `daily-reset`, so the "done" check in a guest workspace can pass.
3. **Chat time limit.**
   - Astra: 60 s. Fable: 120 s, with an internal stop at 100 s.
   - **Ruling:** 120 s. Hobby allows up to 300 s, and a function killed before it finishes would leak budget reservations and orphan approval cards. It's one line to change back.
   - Astra correctly pointed out that a 90 s turn lock would overlap. The lock is now 150 s, and only the holder's token can release it.
4. **When approvals become durable.**
   - Both sides converged here. Pending rows are written the moment an approval is requested, before the card streams to the browser. The user's message is saved before generation starts.
5. **Who may write `copilot_messages`.**
   - Fable is right that locking the table in 042 would break the live site between the hand-applied migration and the deploy.
   - **Ruling:** 042 leaves it alone, history is written with the service role from day one, and migration **044** locks member writes. **You apply 044 only after the deploy.**
6. **Stale writes and diff accuracy.**
   - Astra is right that a separate staleness check still has a race, and that a diff of raw input can misdescribe fields the handler maps to other columns.
   - **Ruling:** each write tool exposes `toPatch(input)`. The diff is computed over that exact patch, and the write is conditioned on `updated_at`.
7. **Scheduled writes.**
   - Astra is right that SDK approval mid-run would stop before queuing anything.
   - **Ruling:** in task mode, record tools only record a proposal and return. A claim that re-checks eligibility atomically stops the same occurrence running twice.
8. **Steps across approval continuations.**
   - **Ruling:** Fable's position, a limit of 8 per request. A request with neither a new message nor a claimable approval is rejected, so continuing always needs a human action, and the shared budget reserves every step.
9. **Verification discipline.**
   - **Ruling:** Fable's position. Every check names the assertions it must make, there's no prose "contract doc" task, and nothing uses `rg`.
10. **Batches of approvals.**
    - One invalid approval id fails only itself. A claimed approval whose execution fails is marked failed or stale, never stuck.

## Open risks

- **Whether `draft_email` needs approval.**
  - Fable: it's low risk and auto-applies with undo, since it's the same as saving an artifact.
  - Astra: it should use the normal approval flow.
  - **Chosen:** low risk. It never sends anything (D3).
  - Settles it: your preference. Change one entry in `LOW_RISK_WRITES` to switch.
- **Time to finish a turn.** Settles it: measure the "done" turn (a search plus 12 proposals) from sin1 against the real provider. If p95 is under 45 s, 60 s would have been enough.
- **Getting the diff to the approval card.** Whether the AI SDK can attach a server-computed diff to the approval request is unverified. T13 falls back to a typed data part keyed by `toolCallId`.
- **The test helper is shared with verify-track** (`tests/helpers/pglite.ts`). Whichever plan runs second extends it; `tasks-verify-track.json` T1 now says so.
- **The guest purge removes a guest's tasks** after 7 days. That's by design and is stated in the composer.
- **PGlite isn't production Supabase.** Each migration header ends with a smoke block for you to run once.
- **Nightly cron capacity.** Tasks run least-recently-served first, under a 200 s deadline, and the rest wait for the next night. At scale, a dedicated cron would be needed.

## Rejected alternatives

- Trusting browser-sent tool or approval parts, even with an HMAC signature.
- Copilot-only tool code separate from MCP, or calling the HTTP MCP endpoint (it would act through the admin key).
- Keeping the old `execute-action` route. It writes without the approval path, so it's deleted.
- A third cron, a queue or a workflow engine.
- Re-running the model to resolve a task approval.
- Hard-deleting artifacts or memory on undo; soft delete is used instead.
- Silently treating an invalid custom schedule as daily.

## Your actions

1. **Before the deploy:** run migrations **042** and **043** in order in the Supabase SQL editor, then the smoke block at the end of each header.
2. **Deploy:** push, with your go-ahead.
3. **After the deploy:** run migration **044**, which stops the browser writing chat messages directly, then its smoke block.
4. **Live check:** in a guest workspace, follow the "Done means" list in the brief.

No new environment variables are needed.
