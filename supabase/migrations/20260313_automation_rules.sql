-- Phase 1: Automation Rules Engine
-- Creates automation_rules and automation_executions tables
-- Adds new columns to leads and lead_searches tables

-- ─── automation_rules ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  conditions JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  execution_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_rules_org_isolation" ON automation_rules
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_type) WHERE is_active = true;

-- ─── automation_executions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  trigger_data JSONB DEFAULT '{}',
  actions_executed JSONB DEFAULT '[]',
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_lead ON automation_executions(lead_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_created ON automation_executions(created_at DESC);

-- ─── Alter leads table ────────────────────────────────────────────────────────

ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ;

-- ─── Alter lead_searches table (for recurring scrapes) ───────────────────────

ALTER TABLE lead_searches ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE lead_searches ADD COLUMN IF NOT EXISTS schedule_frequency TEXT DEFAULT 'daily';
ALTER TABLE lead_searches ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE lead_searches ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
ALTER TABLE lead_searches ADD COLUMN IF NOT EXISTS auto_import BOOLEAN DEFAULT false;
ALTER TABLE lead_searches ADD COLUMN IF NOT EXISTS auto_enroll_sequence_id UUID REFERENCES sequences(id);

-- ─── Alter scraped_leads table ────────────────────────────────────────────────

ALTER TABLE scraped_leads ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';
ALTER TABLE scraped_leads ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE scraped_leads ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES leads(id);
ALTER TABLE scraped_leads ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2) DEFAULT 0;

-- ─── Alter organizations table (booking URL) ─────────────────────────────────

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS booking_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS booking_provider TEXT DEFAULT 'custom';

-- ─── Alter sequence_enrollments (campaign link) ──────────────────────────────

ALTER TABLE sequence_enrollments ADD COLUMN IF NOT EXISTS campaign_id UUID;

-- ─── Alter sequence_steps (booking CTA) ──────────────────────────────────────

ALTER TABLE sequence_steps ADD COLUMN IF NOT EXISTS include_booking_cta BOOLEAN DEFAULT false;

-- ─── Custom fields tables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT DEFAULT 'lead',
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT DEFAULT 'text',
  options JSONB DEFAULT '[]',
  is_merge_field BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, entity_type, field_key)
);

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_fields_org_isolation" ON custom_fields
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS lead_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, field_id)
);

ALTER TABLE lead_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_custom_field_values_isolation" ON lead_custom_field_values
  FOR ALL USING (
    lead_id IN (SELECT id FROM leads WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  );

-- ─── Campaign runs table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  sequence_id UUID REFERENCES sequences(id),
  audience_type TEXT DEFAULT 'manual',
  audience_filters JSONB DEFAULT '{}',
  audience_lead_ids UUID[] DEFAULT '{}',
  email_account_ids UUID[] DEFAULT '{}',
  rotation_strategy TEXT DEFAULT 'round_robin',
  daily_send_limit INTEGER DEFAULT 100,
  start_date TIMESTAMPTZ,
  schedule_timezone TEXT DEFAULT 'UTC',
  schedule_windows JSONB DEFAULT '[]',
  total_audience INTEGER DEFAULT 0,
  total_enrolled INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campaign_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_runs_org_isolation" ON campaign_runs
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TRIGGER update_campaign_runs_updated_at
  BEFORE UPDATE ON campaign_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_runs(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES sequence_enrollments(id),
  status TEXT DEFAULT 'pending',
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON campaign_leads(lead_id);

-- ─── Helper function: increment automation rule count ─────────────────────────

CREATE OR REPLACE FUNCTION increment_automation_rule_count(rule_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE automation_rules
  SET execution_count = execution_count + 1
  WHERE id = rule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
