-- ============================================================================
-- 027_lead_finder_parity.sql
--
-- Brings Pulse CRM's Lead Finder schema to parity with the stand-alone
-- lead-finder project so we can port its durable enrichment worker, its AI
-- provider layer (OpenRouter/Groq/Ollama), and its Obsidian sync logic.
--
-- This migration is idempotent: every ALTER/CREATE uses IF [NOT] EXISTS and
-- every enum widen is done via DROP + ADD CHECK so re-running is safe.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Widen ai_settings with lead-finder–specific fields.
--    Some columns already exist in the generated types (added informally);
--    the IF NOT EXISTS guards keep this safe for any deployed database state.
-- ---------------------------------------------------------------------------

ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS apify_api_key              text,
  ADD COLUMN IF NOT EXISTS openrouter_api_key         text,
  ADD COLUMN IF NOT EXISTS openrouter_oauth_token     text,
  ADD COLUMN IF NOT EXISTS openrouter_code_verifier   text,
  ADD COLUMN IF NOT EXISTS openrouter_expires_at      timestamptz,
  ADD COLUMN IF NOT EXISTS groq_api_key               text,
  ADD COLUMN IF NOT EXISTS ollama_base_url            text,
  ADD COLUMN IF NOT EXISTS ai_provider                text,
  -- Obsidian vault path for per-org sync (lead-finder feature parity).
  ADD COLUMN IF NOT EXISTS obsidian_vault_path        text,
  ADD COLUMN IF NOT EXISTS obsidian_sync_enabled      boolean NOT NULL DEFAULT false;

-- Broaden the AI provider string allowlist to match lead-finder.
ALTER TABLE ai_settings
  DROP CONSTRAINT IF EXISTS ai_settings_ai_provider_check;

ALTER TABLE ai_settings
  ADD CONSTRAINT ai_settings_ai_provider_check
  CHECK (
    ai_provider IS NULL OR ai_provider IN (
      'anthropic', 'openai', 'openrouter', 'groq', 'ollama', 'ollama_cloud'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Widen lf_campaigns.
--    - add `search_params` (lead-finder's campaign-level search config)
--    - add `agency_type` (used for per-campaign prompt scoping)
--    - widen `ai_provider` enum to match new allowlist
--    - add `obsidian_sync_enabled` per-campaign override
-- ---------------------------------------------------------------------------

ALTER TABLE lf_campaigns
  ADD COLUMN IF NOT EXISTS search_params          jsonb  NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS agency_type            text   NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS obsidian_sync_enabled  boolean NOT NULL DEFAULT false;

ALTER TABLE lf_campaigns
  DROP CONSTRAINT IF EXISTS lf_campaigns_ai_provider_check;

ALTER TABLE lf_campaigns
  ADD CONSTRAINT lf_campaigns_ai_provider_check
  CHECK (ai_provider IN (
    'anthropic', 'openai', 'openrouter', 'groq', 'ollama', 'ollama_cloud'
  ));

-- ---------------------------------------------------------------------------
-- 3. Widen lf_llm_costs.provider to include OpenRouter / Groq / Ollama.
-- ---------------------------------------------------------------------------

ALTER TABLE lf_llm_costs
  DROP CONSTRAINT IF EXISTS lf_llm_costs_provider_check;

ALTER TABLE lf_llm_costs
  ADD CONSTRAINT lf_llm_costs_provider_check
  CHECK (provider IN (
    'openai', 'anthropic', 'openrouter', 'groq', 'ollama', 'ollama_cloud', 'minimax'
  ));

-- ---------------------------------------------------------------------------
-- 4. Durable enrichment worker queue.
--
-- `lf_enrichment_batches` is a rollup of related enrichment jobs (e.g. a
-- bulk-enrich action produces one batch with N jobs).
-- `lf_enrichment_jobs` is the queue itself, consumed by the background
-- worker pump.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lf_enrichment_batches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id      uuid REFERENCES lf_campaigns(id) ON DELETE CASCADE,
  label            text,
  total            integer NOT NULL DEFAULT 0,
  status           text    NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'running', 'paused', 'done', 'cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  finished_at      timestamptz
);

CREATE TABLE IF NOT EXISTS lf_enrichment_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id         uuid NOT NULL REFERENCES lf_enrichment_batches(id) ON DELETE CASCADE,
  lead_id          uuid NOT NULL REFERENCES lf_leads(id) ON DELETE CASCADE,
  actor_ids        jsonb NOT NULL DEFAULT '[]'::jsonb,
  status           text  NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'running', 'done', 'failed', 'retry', 'cancelled')),
  attempts         integer NOT NULL DEFAULT 0,
  last_error       text,
  started_at       timestamptz,
  finished_at      timestamptz,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Worker scans for the next runnable job.
CREATE INDEX IF NOT EXISTS idx_lf_enrichment_jobs_runnable
  ON lf_enrichment_jobs (next_attempt_at)
  WHERE status IN ('queued', 'retry');

-- Plan-mandated composite index for (status, next_attempt_at) probes.
CREATE INDEX IF NOT EXISTS idx_lf_enrichment_jobs_status_next_attempt
  ON lf_enrichment_jobs (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_lf_enrichment_jobs_batch
  ON lf_enrichment_jobs (batch_id);

CREATE INDEX IF NOT EXISTS idx_lf_enrichment_jobs_lead
  ON lf_enrichment_jobs (lead_id);

CREATE INDEX IF NOT EXISTS idx_lf_enrichment_jobs_org
  ON lf_enrichment_jobs (organization_id);

CREATE INDEX IF NOT EXISTS idx_lf_enrichment_batches_org
  ON lf_enrichment_batches (organization_id);

CREATE INDEX IF NOT EXISTS idx_lf_enrichment_batches_campaign
  ON lf_enrichment_batches (campaign_id);

-- ---------------------------------------------------------------------------
-- 5. Obsidian sync state per org (tracks last synced lead id so the pump
--    only writes new or updated notes).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lf_obsidian_sync_state (
  organization_id   uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_synced_at    timestamptz,
  last_synced_lead  uuid REFERENCES lf_leads(id) ON DELETE SET NULL,
  cursor            jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 6. Add organization_id to lf_analytics_events for explicit delete scoping.
--    (it already exists in 025_lead_finder.sql; left here as a comment).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 7. RLS policies for the new tables.
-- ---------------------------------------------------------------------------

ALTER TABLE lf_enrichment_batches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lf_enrichment_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lf_obsidian_sync_state    ENABLE ROW LEVEL SECURITY;

-- Enrichment batches
DROP POLICY IF EXISTS "org can read lf_enrichment_batches"   ON lf_enrichment_batches;
DROP POLICY IF EXISTS "org can write lf_enrichment_batches"  ON lf_enrichment_batches;
CREATE POLICY "org can read lf_enrichment_batches"
  ON lf_enrichment_batches FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "org can write lf_enrichment_batches"
  ON lf_enrichment_batches FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Enrichment jobs
DROP POLICY IF EXISTS "org can read lf_enrichment_jobs"   ON lf_enrichment_jobs;
DROP POLICY IF EXISTS "org can write lf_enrichment_jobs"  ON lf_enrichment_jobs;
CREATE POLICY "org can read lf_enrichment_jobs"
  ON lf_enrichment_jobs FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "org can write lf_enrichment_jobs"
  ON lf_enrichment_jobs FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Obsidian sync state
DROP POLICY IF EXISTS "org can read lf_obsidian_sync_state"   ON lf_obsidian_sync_state;
DROP POLICY IF EXISTS "org can write lf_obsidian_sync_state"  ON lf_obsidian_sync_state;
CREATE POLICY "org can read lf_obsidian_sync_state"
  ON lf_obsidian_sync_state FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "org can write lf_obsidian_sync_state"
  ON lf_obsidian_sync_state FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 8. Per-lead enrichment bookkeeping columns (surfaced to UI + used by worker
--    retry logic). These mirror lead-finder's schema.
-- ---------------------------------------------------------------------------

ALTER TABLE lf_leads
  ADD COLUMN IF NOT EXISTS last_enrich_error      text,
  ADD COLUMN IF NOT EXISTS last_enrich_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrich_attempts        integer NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 9. Helpful indexes for frequent worker queries on lf_leads.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_lf_leads_org_status
  ON lf_leads (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_lf_leads_campaign_status
  ON lf_leads (campaign_id, status);
