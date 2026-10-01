-- ============================================================
-- 042 Copilot v2: server-owned history, server-write-only approvals,
--     always-allow list, page conversations, turn lock
--
-- copilot_messages
--   parts      jsonb    the AI SDK UIMessage parts, written by the server
--   message_id text     the UIMessage id; unique per conversation when set
--   seq        integer  ordering within a conversation
--   Rows written before this migration keep parts NULL and still read.
--   The existing org_access policy (021) is NOT changed here: the legacy
--   client write path must keep working until the new code deploys.
--   Migration 044 locks it down.
--
-- copilot_conversations
--   page_key         text         one conversation per (org, user, page)
--   turn_lock_until  timestamptz  a turn holds the lock until this time
--   turn_lock_token  uuid         the holder's token
--   Acquire sets turn_lock_until = now() + 150 s (longer than the chat
--   route's maxDuration of 120 s) and a fresh token, only when the lock is
--   free or expired. Release clears both columns only WHERE
--   turn_lock_token = the caller's token, so a request whose lock expired
--   can never clear a newer holder's lock. The app runs those UPDATEs.
--
-- copilot_approvals (new)
--   One row per proposed write (chat or scheduled task). RLS is enabled with
--   ONE policy: org members may SELECT their org's rows. There is no INSERT,
--   UPDATE or DELETE policy, so only the service role (lib/ai/approvals.ts)
--   writes. A claim is an atomic
--     UPDATE ... SET status = 'approved' WHERE id = $1 AND status = 'pending'.
--
-- ai_settings
--   copilot_always_allow jsonb  tool names the org lets run without approval
--
-- Runs as one transaction. Safe to re-run: ADD COLUMN IF NOT EXISTS,
-- CREATE TABLE / INDEX IF NOT EXISTS, DROP POLICY IF EXISTS + CREATE POLICY,
-- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT.
-- Apply by hand in the Supabase SQL editor (paste the whole file, Run), then
-- run the smoke queries at the bottom.
-- ============================================================

BEGIN;


-- ─── copilot_messages: server-owned history ─────────────────────────────────

ALTER TABLE public.copilot_messages
  ADD COLUMN IF NOT EXISTS parts jsonb,
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS seq integer;

CREATE UNIQUE INDEX IF NOT EXISTS copilot_messages_conv_msg_uq
  ON public.copilot_messages (conversation_id, message_id)
  WHERE message_id IS NOT NULL;


-- ─── copilot_conversations: page conversations + turn lock ──────────────────

ALTER TABLE public.copilot_conversations
  ADD COLUMN IF NOT EXISTS page_key text,
  ADD COLUMN IF NOT EXISTS turn_lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS turn_lock_token uuid;

CREATE UNIQUE INDEX IF NOT EXISTS copilot_conversations_page_uq
  ON public.copilot_conversations (organization_id, user_id, page_key)
  WHERE page_key IS NOT NULL;


-- ─── copilot_approvals: server-write-only ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.copilot_approvals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id         uuid NULL,
  conversation_id uuid NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
  task_id         uuid NULL,
  tool_call_id    text NOT NULL,
  approval_id     text NULL,
  tool_name       text NOT NULL,
  input           jsonb NOT NULL,
  diff            jsonb NOT NULL,
  source          text NOT NULL CHECK (source IN ('chat', 'task')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'denied', 'applied', 'failed', 'stale', 'expired')),
  result          jsonb NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz NULL,
  UNIQUE (organization_id, tool_call_id)
);

-- The org FK lives here, not in CREATE TABLE, so a table created by an
-- earlier run of this file gets it too. Task-sourced rows have no
-- conversation to cascade from; the guest purge deletes whole orgs.
-- (DROP + ADD instead of a DO block keeps the file to a single transaction
-- opener, as the idempotency lint expects.)
ALTER TABLE public.copilot_approvals
  DROP CONSTRAINT IF EXISTS copilot_approvals_organization_id_fkey;
ALTER TABLE public.copilot_approvals
  ADD CONSTRAINT copilot_approvals_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS copilot_approvals_org_approval_uq
  ON public.copilot_approvals (organization_id, approval_id)
  WHERE approval_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS copilot_approvals_org_status_created_idx
  ON public.copilot_approvals (organization_id, status, created_at DESC);

ALTER TABLE public.copilot_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS copilot_approvals_select_org ON public.copilot_approvals;
CREATE POLICY copilot_approvals_select_org ON public.copilot_approvals
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()));


-- ─── ai_settings: always-allow list ─────────────────────────────────────────

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS copilot_always_allow jsonb NOT NULL DEFAULT '[]'::jsonb;


COMMIT;


-- ─── Smoke after apply (run these by hand; each should hold) ────────────────
--
-- New columns exist (expect 7 rows):
--   SELECT table_name, column_name FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND (table_name, column_name) IN (
--        ('copilot_messages', 'parts'), ('copilot_messages', 'message_id'),
--        ('copilot_messages', 'seq'), ('copilot_conversations', 'page_key'),
--        ('copilot_conversations', 'turn_lock_until'),
--        ('copilot_conversations', 'turn_lock_token'),
--        ('ai_settings', 'copilot_always_allow'));
--
-- copilot_approvals has RLS on and exactly one policy, a SELECT
-- (expect t, then one row: copilot_approvals_select_org | SELECT):
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public.copilot_approvals'::regclass;
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'copilot_approvals';
--
-- The copilot_messages policies are unchanged (expect org_access | ALL):
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'copilot_messages';
--
-- Indexes exist (expect 4 rows):
--   SELECT indexname FROM pg_indexes
--    WHERE indexname IN ('copilot_messages_conv_msg_uq', 'copilot_conversations_page_uq',
--                        'copilot_approvals_org_approval_uq',
--                        'copilot_approvals_org_status_created_idx');
