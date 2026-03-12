-- ============================================================
-- Phase 7: Lead Scoring Engine
-- ============================================================

-- ── scoring_profiles ────────────────────────────────────────
-- Org-scoped configurable scoring weights and targets
CREATE TABLE IF NOT EXISTS scoring_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Default',

  -- Weights must sum to 100
  weight_company_size   INT NOT NULL DEFAULT 20,
  weight_industry_fit   INT NOT NULL DEFAULT 25,
  weight_engagement     INT NOT NULL DEFAULT 20,
  weight_source_quality INT NOT NULL DEFAULT 15,
  weight_budget         INT NOT NULL DEFAULT 20,

  -- Target criteria
  target_industries     TEXT[] NOT NULL DEFAULT '{}',
  target_company_sizes  TEXT[] NOT NULL DEFAULT '{}',

  -- Source rankings  (source → quality score 0-100)
  source_rankings       JSONB NOT NULL DEFAULT '{
    "Referral": 95,
    "LinkedIn": 80,
    "Website": 70,
    "Event": 65,
    "Google Ads": 60,
    "Cold Call": 40
  }'::jsonb,

  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE scoring_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoring_profiles_org" ON scoring_profiles
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── lead_score_history ──────────────────────────────────────
-- Tracks score changes over time for trend analysis
CREATE TABLE IF NOT EXISTS lead_score_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score       INT NOT NULL,
  breakdown   JSONB NOT NULL DEFAULT '{}',
  scored_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_score_history_via_lead" ON lead_score_history
  FOR ALL USING (
    lead_id IN (
      SELECT id FROM leads WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Index for fast history lookups
CREATE INDEX IF NOT EXISTS idx_lead_score_history_lead
  ON lead_score_history(lead_id, scored_at DESC);

-- ── Alter leads table ───────────────────────────────────────
-- Add scoring metadata columns
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS score_breakdown  JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_scored_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS engagement_score INT DEFAULT 0;

-- ── Trigger for updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_scoring_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scoring_profiles_updated_at
  BEFORE UPDATE ON scoring_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_scoring_profiles_updated_at();
