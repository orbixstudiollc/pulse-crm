-- ============================================================================
-- Phase 16: AI Marketing Suite
-- ============================================================================

-- ── marketing_audits ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Target
  website_url     TEXT NOT NULL,
  business_name   TEXT,
  business_type   TEXT,          -- 'saas' | 'ecommerce' | 'agency' | 'local' | 'creator' | 'marketplace'

  -- Audit type & status
  audit_type      TEXT NOT NULL DEFAULT 'full',
    -- 'full' | 'quick' | 'seo' | 'copywriting' | 'landing_page' | 'brand_voice' | 'funnel' | 'competitor_intel'
  status          TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'running' | 'completed' | 'failed'
  progress        INT DEFAULT 0,  -- 0-100 percent

  -- Scores (full/quick audit)
  overall_score       INT,
  content_score       INT,
  conversion_score    INT,
  seo_score           INT,
  competitive_score   INT,
  brand_score         INT,
  growth_score        INT,
  grade               TEXT,       -- 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

  -- Full result payload
  result          JSONB DEFAULT '{}',
  summary         TEXT,
  error_message   TEXT,

  -- AI metadata
  model_used      TEXT,
  tokens_used     INT DEFAULT 0,
  duration_ms     INT DEFAULT 0,

  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketing_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_audits_org" ON marketing_audits
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE INDEX idx_marketing_audits_org ON marketing_audits(organization_id);
CREATE INDEX idx_marketing_audits_status ON marketing_audits(status);
CREATE INDEX idx_marketing_audits_customer ON marketing_audits(customer_id);
CREATE INDEX idx_marketing_audits_type ON marketing_audits(audit_type);

CREATE TRIGGER set_marketing_audits_updated_at
  BEFORE UPDATE ON marketing_audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── marketing_content ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  audit_id        UUID REFERENCES marketing_audits(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,

  content_type    TEXT NOT NULL,
    -- 'email_sequence' | 'social_calendar' | 'ad_campaign' | 'launch_playbook' | 'client_proposal' | 'brand_voice'
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'generating' | 'completed' | 'exported'

  -- Content payload (type-specific JSON)
  content         JSONB DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',

  -- AI metadata
  model_used      TEXT,
  tokens_used     INT DEFAULT 0,

  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketing_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_content_org" ON marketing_content
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE INDEX idx_marketing_content_org ON marketing_content(organization_id);
CREATE INDEX idx_marketing_content_audit ON marketing_content(audit_id);
CREATE INDEX idx_marketing_content_type ON marketing_content(content_type);

CREATE TRIGGER set_marketing_content_updated_at
  BEFORE UPDATE ON marketing_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── marketing_reports ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  audit_id        UUID NOT NULL REFERENCES marketing_audits(id) ON DELETE CASCADE,

  report_type     TEXT NOT NULL DEFAULT 'markdown',
    -- 'markdown' | 'pdf'
  title           TEXT NOT NULL,
  content         TEXT,             -- Markdown content
  pdf_url         TEXT,             -- Signed URL for PDF
  pdf_storage_path TEXT,            -- Supabase Storage path

  metadata        JSONB DEFAULT '{}',

  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_reports_org" ON marketing_reports
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE INDEX idx_marketing_reports_org ON marketing_reports(organization_id);
CREATE INDEX idx_marketing_reports_audit ON marketing_reports(audit_id);

CREATE TRIGGER set_marketing_reports_updated_at
  BEFORE UPDATE ON marketing_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── marketing_action_items ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_action_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  audit_id        UUID NOT NULL REFERENCES marketing_audits(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,             -- 'content' | 'seo' | 'conversion' | 'brand' | 'growth' | 'competitive'
  tier            TEXT NOT NULL DEFAULT 'medium_term',
    -- 'quick_win' | 'medium_term' | 'strategic'
  priority        TEXT NOT NULL DEFAULT 'medium',
    -- 'critical' | 'high' | 'medium' | 'low'
  status          TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'in_progress' | 'completed' | 'dismissed'
  impact_estimate TEXT,            -- e.g. "$5,000/month" or "15% conversion lift"
  effort          TEXT,            -- 'low' | 'medium' | 'high'

  assigned_to     UUID REFERENCES auth.users(id),
  due_date        DATE,
  completed_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketing_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_action_items_org" ON marketing_action_items
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE INDEX idx_marketing_action_items_org ON marketing_action_items(organization_id);
CREATE INDEX idx_marketing_action_items_audit ON marketing_action_items(audit_id);
CREATE INDEX idx_marketing_action_items_status ON marketing_action_items(status);

CREATE TRIGGER set_marketing_action_items_updated_at
  BEFORE UPDATE ON marketing_action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AI Settings extension ───────────────────────────────────────────────────

ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS feature_marketing BOOLEAN DEFAULT true;
