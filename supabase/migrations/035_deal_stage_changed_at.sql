-- ============================================================
-- 035 deals.stage_changed_at: when the deal entered its current stage
--
-- deals.days_in_stage (001_initial_schema.sql) was reset to 0 on every stage
-- change and never incremented, so "days in stage" stayed at 0 forever. The
-- app now derives it from a timestamp instead: stage_changed_at is written
-- whenever the stage changes (and on insert via the default), and the UI and
-- AI prompts compute whole days from it (lib/deals/metrics.ts stageDays).
--
-- Existing rows are backfilled with updated_at (the best available proxy for
-- the last stage change), falling back to created_at. The set_updated_at
-- trigger is paused for the backfill so it does not bump every updated_at.
-- days_in_stage is left in place but is no longer read.
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;

ALTER TABLE deals DISABLE TRIGGER set_updated_at;

UPDATE deals
SET stage_changed_at = COALESCE(updated_at, created_at, now())
WHERE stage_changed_at IS NULL;

ALTER TABLE deals ENABLE TRIGGER set_updated_at;

ALTER TABLE deals ALTER COLUMN stage_changed_at SET DEFAULT now();
