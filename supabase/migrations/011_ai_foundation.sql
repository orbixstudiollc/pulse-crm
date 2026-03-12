-- Phase 16: AI Foundation
-- AI settings and usage tracking tables

-- AI Settings (per organization)
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- API Configuration
  api_key TEXT,
  default_model TEXT NOT NULL DEFAULT 'sonnet',

  -- Feature Toggles
  feature_lead_scoring BOOLEAN NOT NULL DEFAULT true,
  feature_icp_matching BOOLEAN NOT NULL DEFAULT true,
  feature_outreach BOOLEAN NOT NULL DEFAULT true,
  feature_proposals BOOLEAN NOT NULL DEFAULT true,
  feature_meetings BOOLEAN NOT NULL DEFAULT true,
  feature_analytics BOOLEAN NOT NULL DEFAULT true,
  feature_competitors BOOLEAN NOT NULL DEFAULT true,
  feature_objections BOOLEAN NOT NULL DEFAULT true,
  feature_chat BOOLEAN NOT NULL DEFAULT true,

  -- Autonomy Levels (suggest | auto_act | full_auto)
  autonomy_lead_scoring TEXT NOT NULL DEFAULT 'suggest',
  autonomy_icp_matching TEXT NOT NULL DEFAULT 'suggest',
  autonomy_outreach TEXT NOT NULL DEFAULT 'suggest',
  autonomy_proposals TEXT NOT NULL DEFAULT 'suggest',
  autonomy_meetings TEXT NOT NULL DEFAULT 'suggest',
  autonomy_analytics TEXT NOT NULL DEFAULT 'suggest',
  autonomy_competitors TEXT NOT NULL DEFAULT 'suggest',
  autonomy_objections TEXT NOT NULL DEFAULT 'suggest',

  -- Token Usage Tracking
  tokens_used_today INTEGER NOT NULL DEFAULT 0,
  tokens_used_month INTEGER NOT NULL DEFAULT 0,
  daily_token_limit INTEGER NOT NULL DEFAULT 100000,
  monthly_token_limit INTEGER NOT NULL DEFAULT 2000000,
  last_token_reset_daily TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_token_reset_monthly TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One settings row per org
  UNIQUE(organization_id)
);

-- AI Usage Log
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at on ai_settings
CREATE TRIGGER ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_ai_usage_log_org_created ON ai_usage_log(organization_id, created_at DESC);
CREATE INDEX idx_ai_usage_log_user_created ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_log_feature ON ai_usage_log(feature);

-- RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- AI Settings policies
CREATE POLICY "Users can view their org AI settings"
  ON ai_settings FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert their org AI settings"
  ON ai_settings FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their org AI settings"
  ON ai_settings FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- AI Usage Log policies
CREATE POLICY "Users can view their org usage logs"
  ON ai_usage_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert usage logs"
  ON ai_usage_log FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- Service role needs full access for token logging
CREATE POLICY "Service role full access to ai_settings"
  ON ai_settings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to ai_usage_log"
  ON ai_usage_log FOR ALL
  USING (auth.role() = 'service_role');
