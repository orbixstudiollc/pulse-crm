-- ============================================================
-- 044 Copilot v2: copilot_messages becomes server-write-only
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
-- Runs as one transaction. Safe to re-run: DROP POLICY IF EXISTS before
-- CREATE POLICY.
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


COMMIT;


-- ─── Smoke after apply (run these by hand; each should hold) ────────────────
--
-- RLS is on and there is exactly one policy, a SELECT
-- (expect t, then one row: copilot_messages_select_org | SELECT):
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public.copilot_messages'::regclass;
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'copilot_messages';
--
-- No write policy is left (expect 0):
--   SELECT count(*) FROM pg_policies
--    WHERE tablename = 'copilot_messages' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');
--
-- After the next Copilot chat turn in the app, its messages were stored
-- (expect recent rows with message_id and parts set):
--   SELECT created_at, role, message_id, parts IS NOT NULL AS has_parts
--     FROM public.copilot_messages ORDER BY created_at DESC LIMIT 5;
