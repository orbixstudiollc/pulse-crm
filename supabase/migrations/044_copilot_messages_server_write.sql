-- ============================================================
-- 044 Copilot v2: copilot_messages becomes server-write-only, and each
--     member owns (and alone sees) their own copilot_conversations,
--     copilot_messages, copilot_approvals and copilot_tasks
--
-- APPLY ONLY AFTER the Copilot 2.0 code is deployed.
-- The old client wrote messages directly with the member's session
-- (saveMessage in lib/actions/copilot.ts). Once this runs, those writes fail.
-- The new code writes history with the service role (lib/ai/history.ts),
-- with explicit organization_id and conversation-ownership predicates, so it
-- is not affected.
--
-- copilot_messages
--   Before: one policy, org_access, FOR ALL TO public (021), so any org member
--           could read, INSERT, UPDATE and DELETE every message of their org.
--   After:  one policy, copilot_messages_select_own, FOR SELECT TO
--           authenticated: the row is in the member's org AND belongs to a
--           copilot_conversations row of that org whose user_id = auth.uid().
--           There is no INSERT, UPDATE or DELETE policy: an INSERT by a member
--           is rejected by RLS, and an UPDATE or DELETE matches no rows.
--           Only the service role (which bypasses RLS) writes.
--   Member-client reads that remain: lib/actions/copilot-conversations.ts
--   (listConversationMessages, getPageConversation) load the caller's own
--   conversation only, after an org AND user ownership check.
--   Deleting a conversation still removes its messages: the ON DELETE CASCADE
--   from copilot_conversations is a referential action, which RLS does not
--   filter.
--
-- copilot_conversations
--   Before: one policy, org_access, FOR ALL TO public (021), so any org member
--           could rewrite another member's row: change user_id (take the
--           conversation over, and with it the right to approve its cards),
--           set turn_lock_until far in the future (every turn then fails
--           with 409), pre-create another member's page conversation, or
--           delete a conversation (the cascade removed its approved and
--           applied approval rows, bypassing deleteOwnConversations and the
--           turn lock).
--   After:  three policies TO authenticated (copilot_conversations_*_own for
--           SELECT, INSERT, UPDATE), each requiring the member's org AND
--           user_id = auth.uid(), in USING and, for INSERT and UPDATE, in
--           WITH CHECK.
--           Members may UPDATE only title, is_pinned, summary and updated_at
--           (the 030 column-grant pattern: REVOKE the table-level UPDATE,
--           GRANT UPDATE (cols) back). user_id, organization_id, page_key and
--           the turn lock columns are written only by the service role
--           (lib/ai/history.ts, lib/ai/conversation-delete.ts), which keeps
--           its table-level grants and bypasses RLS.
--           Members cannot DELETE at all: no DELETE policy, and DELETE is
--           revoked from anon and authenticated. Conversations are deleted by
--           the service role (deleteConversation, clearChatHistory through
--           lib/ai/conversation-delete.ts), which first detaches the approvals
--           to keep and refuses while the turn lock is held.
--   Member-client writes that remain, all on the member's own rows:
--     INSERT  lib/actions/copilot-conversations.ts (getOrCreateConversation
--             on the RLS client: organization_id, user_id = caller, page_key,
--             title). INSERT is not column-restricted.
--
-- copilot_approvals
--   Before: copilot_approvals_select_org (042), FOR SELECT TO authenticated,
--           so any org member read every member's cards, diffs and results.
--   After:  copilot_approvals_select_own, FOR SELECT TO authenticated: the
--           member's org AND user_id = auth.uid(). Still no write policy (042):
--           only the service role writes. The one member-client read,
--           listPendingApprovalsAction (lib/actions/copilot-approvals.ts),
--           lists the caller's own pending rows; only the owner can resolve a
--           row, so nothing needs another member's rows.
--
-- copilot_tasks
--   Before: one policy, org_access, FOR ALL TO public (021), so any org member
--           could read, edit, reassign or delete every member's tasks.
--   After:  four policies TO authenticated (copilot_tasks_*_own for SELECT,
--           INSERT, UPDATE, DELETE), each requiring the member's org AND
--           user_id = auth.uid(), in USING and, for INSERT and UPDATE, in
--           WITH CHECK. The scheduler (lib/ai/tasks) uses the service role.
--   Member-client paths, all on the member's own rows: lib/actions/copilot.ts
--   (getCopilotTasks, createCopilotTask, updateCopilotTask, deleteCopilotTask),
--   lib/actions/copilot-tasks.ts (createTaskFromPrompt) and the create_task
--   Copilot tool (lib/ai/tools/copilot-tools.ts). Their active-task cap count
--   now sees only the caller's own tasks.
--
-- Runs as one transaction. Safe to re-run: DROP POLICY IF EXISTS before
-- CREATE POLICY; REVOKE then GRANT.
-- Apply by hand in the Supabase SQL editor (paste the whole file, Run), then
-- run the smoke queries at the bottom.
-- ============================================================

BEGIN;


-- ─── copilot_messages: members read their own, the server writes ────────────

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_access ON public.copilot_messages;
-- An earlier draft of this migration created an org-wide SELECT policy.
DROP POLICY IF EXISTS copilot_messages_select_org ON public.copilot_messages;

DROP POLICY IF EXISTS copilot_messages_select_own ON public.copilot_messages;
CREATE POLICY copilot_messages_select_own ON public.copilot_messages
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.copilot_conversations c
       WHERE c.id = copilot_messages.conversation_id
         AND c.organization_id = copilot_messages.organization_id
         AND c.user_id = (SELECT auth.uid())
    )
  );


-- ─── copilot_conversations: each member owns their rows ─────────────────────

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_access ON public.copilot_conversations;

DROP POLICY IF EXISTS copilot_conversations_select_own ON public.copilot_conversations;
CREATE POLICY copilot_conversations_select_own ON public.copilot_conversations
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS copilot_conversations_insert_own ON public.copilot_conversations;
CREATE POLICY copilot_conversations_insert_own ON public.copilot_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS copilot_conversations_update_own ON public.copilot_conversations;
CREATE POLICY copilot_conversations_update_own ON public.copilot_conversations
  FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  );

-- No member DELETE (an earlier draft of this migration created one).
DROP POLICY IF EXISTS copilot_conversations_delete_own ON public.copilot_conversations;
REVOKE DELETE ON public.copilot_conversations FROM anon, authenticated;

-- A column-level REVOKE alone is a no-op while the table-level grant exists,
-- so the table-level UPDATE is revoked (which also drops any column UPDATE
-- grants) and the member-editable columns are granted back.
REVOKE UPDATE ON public.copilot_conversations FROM anon, authenticated;
GRANT UPDATE (title, is_pinned, summary, updated_at) ON public.copilot_conversations TO authenticated;


-- ─── copilot_approvals: members read their own, the server writes ───────────

DROP POLICY IF EXISTS copilot_approvals_select_org ON public.copilot_approvals;

DROP POLICY IF EXISTS copilot_approvals_select_own ON public.copilot_approvals;
CREATE POLICY copilot_approvals_select_own ON public.copilot_approvals
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  );


-- ─── copilot_tasks: each member owns their rows ─────────────────────────────

ALTER TABLE public.copilot_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_access ON public.copilot_tasks;

DROP POLICY IF EXISTS copilot_tasks_select_own ON public.copilot_tasks;
CREATE POLICY copilot_tasks_select_own ON public.copilot_tasks
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS copilot_tasks_insert_own ON public.copilot_tasks;
CREATE POLICY copilot_tasks_insert_own ON public.copilot_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS copilot_tasks_update_own ON public.copilot_tasks;
CREATE POLICY copilot_tasks_update_own ON public.copilot_tasks
  FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS copilot_tasks_delete_own ON public.copilot_tasks;
CREATE POLICY copilot_tasks_delete_own ON public.copilot_tasks
  FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  );


COMMIT;


-- ─── Smoke after apply (run these by hand; each should hold) ────────────────
--
-- copilot_messages: RLS is on and there is exactly one policy, a SELECT
-- (expect t, then one row: copilot_messages_select_own | SELECT):
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public.copilot_messages'::regclass;
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'copilot_messages';
--
-- No write policy is left on copilot_messages (expect 0):
--   SELECT count(*) FROM pg_policies
--    WHERE tablename = 'copilot_messages' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');
--
-- copilot_conversations: exactly the three per-user policies, no org_access
-- and no DELETE policy (expect 3 rows: copilot_conversations_insert_own |
-- INSERT, _select_own | SELECT, _update_own | UPDATE):
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'copilot_conversations' ORDER BY policyname;
--
-- Members cannot delete conversations; the service role can (expect f, f, t):
--   SELECT has_table_privilege('authenticated', 'public.copilot_conversations', 'DELETE'),
--          has_table_privilege('anon', 'public.copilot_conversations', 'DELETE'),
--          has_table_privilege('service_role', 'public.copilot_conversations', 'DELETE');
--
-- Members may update only these columns (expect 4 rows: is_pinned, summary,
-- title, updated_at):
--   SELECT column_name FROM information_schema.column_privileges
--    WHERE table_schema = 'public' AND table_name = 'copilot_conversations'
--      AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
--    ORDER BY column_name;
--
-- copilot_approvals: exactly one policy, the per-user SELECT
-- (expect one row: copilot_approvals_select_own | SELECT):
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'copilot_approvals';
--
-- copilot_tasks: exactly the four per-user policies, no org_access
-- (expect 4 rows: copilot_tasks_delete_own | DELETE, _insert_own | INSERT,
-- _select_own | SELECT, _update_own | UPDATE):
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'copilot_tasks' ORDER BY policyname;
--
-- After the next Copilot chat turn in the app, its messages were stored
-- (expect recent rows with message_id and parts set):
--   SELECT created_at, role, message_id, parts IS NOT NULL AS has_parts
--     FROM public.copilot_messages ORDER BY created_at DESC LIMIT 5;
