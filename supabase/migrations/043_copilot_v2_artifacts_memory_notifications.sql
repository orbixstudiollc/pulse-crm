-- ============================================================
-- 043 Copilot v2: artifacts, guidance memory, notifications, task runner
--
--   copilot_artifacts  New. Saved copilot output (email drafts, lead lists,
--                      reports, notes), optionally linked to a CRM record.
--                      Soft-deleted through deleted_at. content is capped at
--                      128 KB of JSON text. Members of the org can SELECT,
--                      INSERT and UPDATE (021 org pattern); there is no
--                      DELETE policy.
--
--   copilot_memory     type gains 'guidance' (standing rules for the
--                      copilot). At most 10 ACTIVE guidance rows per org,
--                      enforced by trigger copilot_memory_guidance_cap, which
--                      takes a per-org transaction advisory lock before it
--                      counts, so two concurrent inserts cannot both pass the
--                      check. The error message is 'guidance_cap_exceeded'.
--
--                      source: 021 already created a nullable source column
--                      with CHECK ('manual','website','file'), so ADD COLUMN
--                      IF NOT EXISTS is a no-op there. The column is moved
--                      to the new vocabulary instead: rows are backfilled
--                      (website -> scrape, manual / file / NULL -> user), the
--                      old check is replaced by ('user','copilot','scrape'),
--                      and the column becomes NOT NULL DEFAULT 'user'.
--                      Until the app code ships, the current client still
--                      sends 'manual' and 'website'; trigger
--                      copilot_memory_normalize_source maps those legacy
--                      values (and NULL) before the check runs.
--
--   notifications      New. Written by the server only (no INSERT policy).
--                      Members SELECT rows of their org addressed to them or
--                      to everyone (user_id IS NULL), and UPDATE (mark read)
--                      only rows addressed to them.
--
--   copilot_tasks      Task runner columns: prompt (already NOT NULL since
--                      021, kept as is), locked_at, last_error,
--                      last_artifact_id.
--
-- Runs as one transaction. Safe to re-run: IF NOT EXISTS on tables, columns
-- and indexes, DROP ... IF EXISTS before constraints, triggers and policies,
-- CREATE OR REPLACE FUNCTION, and a backfill that only touches legacy values.
-- Apply by hand in the Supabase SQL editor (paste the whole file, Run).
-- ============================================================

BEGIN;


-- ─── copilot_artifacts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.copilot_artifacts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id            uuid        NULL,
  conversation_id    uuid        NULL REFERENCES public.copilot_conversations(id) ON DELETE SET NULL,
  task_id            uuid        NULL,
  kind               text        NOT NULL
                     CHECK (kind IN ('email_draft', 'lead_list', 'report', 'note')),
  title              text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  content            jsonb       NOT NULL CHECK (octet_length(content::text) <= 131072),
  starred            boolean     NOT NULL DEFAULT false,
  linked_record_type text        NULL
                     CHECK (linked_record_type IN ('lead', 'deal', 'customer', 'contact', 'competitor')),
  linked_record_id   uuid        NULL,
  deleted_at         timestamptz NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_copilot_artifacts_updated_at ON public.copilot_artifacts;
CREATE TRIGGER update_copilot_artifacts_updated_at
  BEFORE UPDATE ON public.copilot_artifacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS copilot_artifacts_org_created_idx
  ON public.copilot_artifacts (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS copilot_artifacts_record_idx
  ON public.copilot_artifacts (organization_id, linked_record_type, linked_record_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.copilot_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS copilot_artifacts_select ON public.copilot_artifacts;
CREATE POLICY copilot_artifacts_select ON public.copilot_artifacts FOR SELECT
  USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS copilot_artifacts_insert ON public.copilot_artifacts;
CREATE POLICY copilot_artifacts_insert ON public.copilot_artifacts FOR INSERT
  WITH CHECK (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS copilot_artifacts_update ON public.copilot_artifacts;
CREATE POLICY copilot_artifacts_update ON public.copilot_artifacts FOR UPDATE
  USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))
  WITH CHECK (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()));


-- ─── copilot_memory: guidance type ──────────────────────────────────────────

ALTER TABLE public.copilot_memory DROP CONSTRAINT IF EXISTS copilot_memory_type_check;
ALTER TABLE public.copilot_memory ADD CONSTRAINT copilot_memory_type_check
  CHECK (type IN ('business_details', 'product_info', 'target_audience', 'brand_voice', 'custom', 'guidance'));


-- ─── copilot_memory: source vocabulary ──────────────────────────────────────

ALTER TABLE public.copilot_memory ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user';

ALTER TABLE public.copilot_memory DROP CONSTRAINT IF EXISTS copilot_memory_source_check;

UPDATE public.copilot_memory
   SET source = CASE WHEN source = 'website' THEN 'scrape' ELSE 'user' END
 WHERE source IS NULL OR source NOT IN ('user', 'copilot', 'scrape');

ALTER TABLE public.copilot_memory ALTER COLUMN source SET DEFAULT 'user';
ALTER TABLE public.copilot_memory ALTER COLUMN source SET NOT NULL;
ALTER TABLE public.copilot_memory ADD CONSTRAINT copilot_memory_source_check
  CHECK (source IN ('user', 'copilot', 'scrape'));

-- Legacy client values, mapped before the CHECK and NOT NULL are evaluated.
CREATE OR REPLACE FUNCTION public.copilot_memory_normalize_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.source IS NULL OR NEW.source IN ('manual', 'file') THEN
    NEW.source := 'user';
  ELSIF NEW.source = 'website' THEN
    NEW.source := 'scrape';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS copilot_memory_normalize_source ON public.copilot_memory;
CREATE TRIGGER copilot_memory_normalize_source
  BEFORE INSERT OR UPDATE ON public.copilot_memory
  FOR EACH ROW EXECUTE FUNCTION public.copilot_memory_normalize_source();


-- ─── copilot_memory: at most 10 active guidance rows per org ────────────────

CREATE OR REPLACE FUNCTION public.copilot_memory_guidance_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.type = 'guidance' AND NEW.is_active THEN
    -- Serialises concurrent writers for this org until commit; the count
    -- below runs after the lock, so it sees rows they committed.
    PERFORM pg_advisory_xact_lock(hashtext('copilot_guidance_' || NEW.organization_id::text));
    IF (SELECT count(*)
          FROM public.copilot_memory
         WHERE organization_id = NEW.organization_id
           AND type = 'guidance'
           AND is_active
           AND id <> NEW.id) >= 10 THEN
      RAISE EXCEPTION 'guidance_cap_exceeded';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS copilot_memory_guidance_cap ON public.copilot_memory;
CREATE TRIGGER copilot_memory_guidance_cap
  BEFORE INSERT OR UPDATE ON public.copilot_memory
  FOR EACH ROW EXECUTE FUNCTION public.copilot_memory_guidance_cap();


-- ─── notifications ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        NULL,
  kind            text        NOT NULL CHECK (kind IN ('task_result', 'approval_pending')),
  title           text        NOT NULL,
  body            text        NULL,
  link            text        NULL,
  read_at         timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (organization_id, user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications FOR UPDATE
  USING (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = auth.uid()
  )
  WITH CHECK (
    organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = auth.uid()
  );


-- ─── copilot_tasks: task runner columns ─────────────────────────────────────

ALTER TABLE public.copilot_tasks ADD COLUMN IF NOT EXISTS prompt text;
ALTER TABLE public.copilot_tasks ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.copilot_tasks ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.copilot_tasks ADD COLUMN IF NOT EXISTS last_artifact_id uuid;


COMMIT;


-- ─── Smoke after apply (run by hand; each should return the noted result) ───
--
-- SELECT to_regclass('public.copilot_artifacts'), to_regclass('public.notifications');
--   -> both non-null
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conname IN ('copilot_memory_type_check', 'copilot_memory_source_check');
--   -> type list includes 'guidance'; source list is user / copilot / scrape
-- SELECT count(*) FROM copilot_memory WHERE source NOT IN ('user', 'copilot', 'scrape');
--   -> 0
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'public.copilot_memory'::regclass AND NOT tgisinternal;
--   -> includes copilot_memory_guidance_cap and copilot_memory_normalize_source
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'copilot_tasks'
--    AND column_name IN ('prompt', 'locked_at', 'last_error', 'last_artifact_id');
--   -> 4 rows
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.notifications'::regclass;
--   -> notifications_select, notifications_update (no insert policy)
