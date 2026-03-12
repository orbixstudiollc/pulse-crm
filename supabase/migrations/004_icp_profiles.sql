-- ============================================================
-- Phase 8: ICP Profiling System
-- ============================================================

-- ── icp_profiles ────────────────────────────────────────────
-- 6-dimensional Ideal Customer Profile
CREATE TABLE IF NOT EXISTS icp_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,

  -- 6-dimensional criteria (from sales-icp framework)
  criteria        JSONB NOT NULL DEFAULT '{
    "firmographic": {
      "industries": [],
      "company_sizes": [],
      "employee_range": { "min": null, "max": null },
      "geography": []
    },
    "technographic": {
      "tech_stack": [],
      "tech_sophistication_min": 0
    },
    "behavioral": {
      "buying_patterns": [],
      "trigger_events": []
    },
    "pain_points": [],
    "budget": {
      "revenue_range": { "min": null, "max": null },
      "deal_size_sweet_spot": null,
      "funding_stages": []
    },
    "channel": {
      "preferred_contact_methods": [],
      "content_preferences": []
    }
  }'::jsonb,

  -- Per-dimension weighting
  weights         JSONB NOT NULL DEFAULT '{
    "industry": 25,
    "size": 20,
    "revenue": 15,
    "title": 15,
    "geography": 15,
    "tech": 10
  }'::jsonb,

  -- Buyer personas (2-3 per ICP)
  buyer_personas  JSONB NOT NULL DEFAULT '[]'::jsonb,

  color           TEXT DEFAULT '#6366f1',
  is_primary      BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE icp_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icp_profiles_org" ON icp_profiles
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── Alter leads table for ICP matching ──────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS icp_match_score     INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS icp_profile_id      UUID REFERENCES icp_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS icp_match_breakdown JSONB DEFAULT NULL;

-- Index for ICP queries
CREATE INDEX IF NOT EXISTS idx_leads_icp_profile
  ON leads(icp_profile_id) WHERE icp_profile_id IS NOT NULL;

-- ── Trigger for updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_icp_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER icp_profiles_updated_at
  BEFORE UPDATE ON icp_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_icp_profiles_updated_at();
