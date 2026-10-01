-- ============================================================
-- 044 Copilot v2: copilot_messages becomes server-write-only, and each
--     member owns their own copilot_conversations
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
--           could INSERT, UPDATE and DELETE their org's messages.
--   After:  one policy, copilot_messages_select_org, FOR SELECT TO
--           authenticated, using the same 021 org-membership predicate.
--           There is no INSERT, UPDATE or DELETE policy: an INSERT by a member
--           is rejected by RLS, and an UPDATE or DELETE matches no rows.
--           Only the service role (which bypasses RLS) writes.
--   Deleting a conversation still removes its messages: the ON DELETE CASCADE
--   from copilot_conversations is a referential action, which RLS does not
--   filter.
--
-- copilot_conversations
--   Before: one policy, org_access, FOR ALL TO public (021), so any org member
--           could rewrite another member's row: change user_id (take the
--           conversation over, and with it the right to approve its cards),
--           set turn_lock_until far in the future (every turn then fails
--           with 409), or pre-create another member's page conversation.
--   After:  four policies TO authenticated (copilot_conversations_*_own for
--           SELECT, INSERT, UPDATE, DELETE), each requiring the member's org
--           AND user_id = auth.uid(), in USING and, for INSERT and UPDATE,
--           in WITH CHECK.
--           Members may UPDATE only title, is_pinned, summary and updated_at
--           (the 030 column-grant pattern: REVOKE the table-level UPDATE,
--           GRANT UPDATE (cols) back). user_id, organization_id, page_key and
--           the turn lock columns are written only by the service role
--           (lib/ai/history.ts, lib/ai/conversation-delete.ts), which keeps
--           its table-level grants and bypasses RLS.
--   Member-client writes that remain, all on the member's own rows:
--     INSERT  lib/actions/copilot-conversations.ts (getOrCreateConversation
--             on the RLS client: organization_id, user_id = caller, page_key,
--             title). INSERT is not column-restricted.
--   Conversations are deleted by the service role (deleteConversation,
--   clearChatHistory), which first detaches the approvals to keep.
--
-- Runs as one transaction. Safe to re-run: DROP POLICY IF EXISTS before
-- CREATE POLICY; REVOKE then GRANT.
-- Apply by hand in the Supabase SQL editor (paste the whole file, Run), then
-- run the smoke queries at the bottom.
-- ============================================================

BEGIN;


-- ─── copilot_messages: members read, the server writes ──────────────────────

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_access ON public.copilot_messages;

DROP POLICY IF EXISTS copilot_messages_select_org ON public.copilot_messages;
CREATE POLICY copilot_messages_select_org ON public.copilot_messages
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()));


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

DROP POLICY IF EXISTS copilot_conversations_delete_own ON public.copilot_conversations;
CREATE POLICY copilot_conversations_delete_own ON public.copilot_conversations
  FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = (SELECT auth.uid())
  );

-- A column-level REVOKE alone is a no-op while the table-level grant exists,
-- so the table-level UPDATE is revoked (which also drops any column UPDATE
-- grants) and the member-editable columns are granted back.
REVOKE UPDATE ON public.copilot_conversations FROM anon, authenticated;
GRANT UPDATE (title, is_pinned, summary, updated_at) ON public.copilot_conversations TO authenticated;


COMMIT;


-- ─── Smoke after apply (run these by hand; each should hold) ────────────────
--
-- copilot_messages: RLS is on and there is exactly one policy, a SELECT
-- (expect t, then one row: copilot_messages_select_org | SELECT):
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public.copilot_messages'::regclass;
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'copilot_messages';
--
-- No write policy is left on copilot_messages (expect 0):
--   SELECT count(*) FROM pg_policies
--    WHERE tablename = 'copilot_messages' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');
--
-- copilot_conversations: exactly the four per-user policies, no org_access
-- (expect 4 rows: copilot_conversations_delete_own | DELETE, _insert_own |
-- INSERT, _select_own | SELECT, _update_own | UPDATE):
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'copilot_conversations' ORDER BY policyname;
--
-- Members may update only these columns (expect 4 rows: is_pinned, summary,
-- title, updated_at):
--   SELECT column_name FROM information_schema.column_privileges
--    WHERE table_schema = 'public' AND table_name = 'copilot_conversations'
--      AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
--    ORDER BY column_name;
--
-- After the next Copilot chat turn in the app, its messages were stored
-- (expect recent rows with message_id and parts set):
--   SELECT created_at, role, message_id, parts IS NOT NULL AS has_parts
--     FROM public.copilot_messages ORDER BY created_at DESC LIMIT 5;
