-- ============================================================================
-- Lead Finder Integration (replaces old lead-scraper)
-- Campaign-based lead discovery, enrichment, and AI scoring
-- ============================================================================

-- 1. Campaigns table
CREATE TABLE IF NOT EXISTS lf_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  target_niche TEXT NOT NULL DEFAULT '',
  apify_actors JSONB DEFAULT '[]'::jsonb,
  actor_configs JSONB DEFAULT '{}'::jsonb,
  kpi_definitions JSONB DEFAULT '[]'::jsonb,
  lead_field_definitions JSONB DEFAULT '[]'::jsonb,
  schedule_frequency TEXT NOT NULL DEFAULT 'once' CHECK (schedule_frequency IN ('once', 'daily', 'weekly')),
  last_discovery_at TIMESTAMPTZ,
  next_discovery_at TIMESTAMPTZ,
  ai_provider TEXT NOT NULL DEFAULT 'anthropic' CHECK (ai_provider IN ('openai', 'anthropic')),
  auto_enrich BOOLEAN NOT NULL DEFAULT true,
  max_leads_per_run INTEGER DEFAULT 50,
  max_pages_per_search INTEGER DEFAULT 5,
  enrichment_concurrency INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Leads found table
CREATE TABLE IF NOT EXISTS lf_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES lf_campaigns(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT '',
  source_run_id TEXT,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'enriching', 'qualified', 'converted', 'declined', 'archived')),
  raw_data JSONB DEFAULT '{}'::jsonb,
  mapped_data JSONB DEFAULT '{}'::jsonb,
  llm_cost_usd NUMERIC(12,6) DEFAULT 0,
  llm_input_tokens INTEGER DEFAULT 0,
  llm_output_tokens INTEGER DEFAULT 0,
  apify_cost_usd NUMERIC(12,6) DEFAULT 0,
  discovery_llm_cost_usd NUMERIC(12,6) DEFAULT 0,
  discovery_apify_cost_usd NUMERIC(12,6) DEFAULT 0,
  imported BOOLEAN DEFAULT false,
  imported_lead_id UUID REFERENCES leads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Lead personalization / enrichment results
CREATE TABLE IF NOT EXISTS lf_lead_personalization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES lf_leads(id) ON DELETE CASCADE,
  website_tech_stack JSONB DEFAULT '[]'::jsonb,
  website_quality_score INTEGER,
  has_chatbot BOOLEAN DEFAULT false,
  has_booking_system BOOLEAN DEFAULT false,
  has_automation BOOLEAN DEFAULT false,
  recent_news TEXT,
  company_description TEXT,
  key_products TEXT,
  founders_info TEXT,
  last_blog_post TEXT,
  social_media_presence JSONB DEFAULT '{}'::jsonb,
  pain_points JSONB DEFAULT '[]'::jsonb,
  personalization_summary TEXT,
  enrichment_actors JSONB DEFAULT '[]'::jsonb,
  raw_enrichment_data JSONB DEFAULT '{}'::jsonb,
  campaign_kpis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Apify run tracking
CREATE TABLE IF NOT EXISTS lf_apify_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES lf_campaigns(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  input_params JSONB DEFAULT '{}'::jsonb,
  result_count INTEGER DEFAULT 0,
  dataset_id TEXT,
  cost_usd NUMERIC(12,6),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- 5. Custom actors per org
CREATE TABLE IF NOT EXISTS lf_custom_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('find', 'enrich')),
  description TEXT,
  required_input_fields JSONB DEFAULT '[]'::jsonb,
  input_field_descriptions JSONB DEFAULT '{}'::jsonb,
  default_input JSONB DEFAULT '{}'::jsonb,
  page_limit_key TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, actor_id)
);

-- 6. LLM cost tracking
CREATE TABLE IF NOT EXISTS lf_llm_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES lf_campaigns(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Analytics events
CREATE TABLE IF NOT EXISTS lf_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  campaign_id UUID REFERENCES lf_campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES lf_leads(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_lf_campaigns_org ON lf_campaigns(organization_id);
CREATE INDEX idx_lf_leads_org ON lf_leads(organization_id);
CREATE INDEX idx_lf_leads_campaign ON lf_leads(campaign_id);
CREATE INDEX idx_lf_leads_email ON lf_leads(email);
CREATE INDEX idx_lf_leads_website ON lf_leads(website);
CREATE INDEX idx_lf_leads_status ON lf_leads(status);
CREATE INDEX idx_lf_leads_imported ON lf_leads(imported);
CREATE INDEX idx_lf_lead_personalization_lead ON lf_lead_personalization(lead_id);
CREATE INDEX idx_lf_apify_runs_org ON lf_apify_runs(organization_id);
CREATE INDEX idx_lf_apify_runs_campaign ON lf_apify_runs(campaign_id);
CREATE INDEX idx_lf_apify_runs_run_id ON lf_apify_runs(run_id);
CREATE INDEX idx_lf_custom_actors_org ON lf_custom_actors(organization_id);
CREATE INDEX idx_lf_llm_costs_org ON lf_llm_costs(organization_id);
CREATE INDEX idx_lf_llm_costs_campaign ON lf_llm_costs(campaign_id);
CREATE INDEX idx_lf_analytics_org ON lf_analytics_events(organization_id);
CREATE INDEX idx_lf_analytics_campaign ON lf_analytics_events(campaign_id);

-- ============================================================================
-- Triggers (reuse existing update_updated_at function)
-- ============================================================================

CREATE TRIGGER set_lf_campaigns_updated_at
  BEFORE UPDATE ON lf_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_lf_leads_updated_at
  BEFORE UPDATE ON lf_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_lf_custom_actors_updated_at
  BEFORE UPDATE ON lf_custom_actors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE lf_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE lf_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lf_lead_personalization ENABLE ROW LEVEL SECURITY;
ALTER TABLE lf_apify_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lf_custom_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE lf_llm_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lf_analytics_events ENABLE ROW LEVEL SECURITY;

-- Campaigns
CREATE POLICY "Users can view own org campaigns" ON lf_campaigns
  FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own org campaigns" ON lf_campaigns
  FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own org campaigns" ON lf_campaigns
  FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete own org campaigns" ON lf_campaigns
  FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Leads
CREATE POLICY "Users can view own org lf_leads" ON lf_leads
  FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own org lf_leads" ON lf_leads
  FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own org lf_leads" ON lf_leads
  FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete own org lf_leads" ON lf_leads
  FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Lead Personalization
CREATE POLICY "Users can view own org lf_personalization" ON lf_lead_personalization
  FOR SELECT USING (lead_id IN (SELECT id FROM lf_leads WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Users can insert own org lf_personalization" ON lf_lead_personalization
  FOR INSERT WITH CHECK (lead_id IN (SELECT id FROM lf_leads WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Users can update own org lf_personalization" ON lf_lead_personalization
  FOR UPDATE USING (lead_id IN (SELECT id FROM lf_leads WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Users can delete own org lf_personalization" ON lf_lead_personalization
  FOR DELETE USING (lead_id IN (SELECT id FROM lf_leads WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- Apify Runs
CREATE POLICY "Users can view own org lf_apify_runs" ON lf_apify_runs
  FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own org lf_apify_runs" ON lf_apify_runs
  FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own org lf_apify_runs" ON lf_apify_runs
  FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Custom Actors
CREATE POLICY "Users can view own org lf_custom_actors" ON lf_custom_actors
  FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own org lf_custom_actors" ON lf_custom_actors
  FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own org lf_custom_actors" ON lf_custom_actors
  FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete own org lf_custom_actors" ON lf_custom_actors
  FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- LLM Costs
CREATE POLICY "Users can view own org lf_llm_costs" ON lf_llm_costs
  FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own org lf_llm_costs" ON lf_llm_costs
  FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Analytics Events
CREATE POLICY "Users can view own org lf_analytics_events" ON lf_analytics_events
  FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own org lf_analytics_events" ON lf_analytics_events
  FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- Add openai_api_key to ai_settings if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_settings' AND column_name = 'openai_api_key'
  ) THEN
    ALTER TABLE ai_settings ADD COLUMN openai_api_key TEXT;
  END IF;
END $$;
