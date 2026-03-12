-- ============================================================
-- Multi-Channel Automation: WhatsApp + LinkedIn
-- Migration: 20260313_multichannel.sql
-- ============================================================

-- ============================================================
-- 1. WHATSAPP ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  phone_number_id text NOT NULL,
  waba_id text NOT NULL,
  access_token_encrypted text NOT NULL,
  display_phone_number text NOT NULL,
  verified_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disconnected','error')),
  daily_send_limit int NOT NULL DEFAULT 1000,
  daily_sent_count int NOT NULL DEFAULT 0,
  quality_rating text,
  messaging_limit text,
  last_error text,
  webhook_secret text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_accounts_org_scope" ON whatsapp_accounts
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TRIGGER set_whatsapp_accounts_updated_at
  BEFORE UPDATE ON whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_org ON whatsapp_accounts(organization_id);

-- ============================================================
-- 2. WHATSAPP TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  meta_template_id text,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'en_US',
  category text NOT NULL DEFAULT 'MARKETING' CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','PAUSED','DISABLED')),
  components jsonb NOT NULL DEFAULT '[]',
  header_type text,
  body_text text,
  footer_text text,
  buttons jsonb,
  example_values jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_templates_org_scope" ON whatsapp_templates
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TRIGGER set_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_account ON whatsapp_templates(whatsapp_account_id);

-- ============================================================
-- 3. WHATSAPP MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  step_id uuid REFERENCES sequence_steps(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','template','image','document','video','audio','sticker','location','contacts')),
  wa_message_id text,
  template_id uuid REFERENCES whatsapp_templates(id),
  template_params jsonb,
  body_text text,
  media_url text,
  media_mime_type text,
  media_caption text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed')),
  error_code text,
  error_message text,
  conversation_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_messages_org_scope" ON whatsapp_messages
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_wa_messages_lead ON whatsapp_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_enrollment ON whatsapp_messages(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_status ON whatsapp_messages(status) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_wa_messages_wa_id ON whatsapp_messages(wa_message_id);

-- ============================================================
-- 4. LINKEDIN ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  linkedin_id text,
  display_name text,
  profile_url text,
  avatar_url text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disconnected','error','rate_limited')),
  -- Rate limit counters
  daily_connection_requests int NOT NULL DEFAULT 0,
  daily_messages_sent int NOT NULL DEFAULT 0,
  weekly_connection_requests int NOT NULL DEFAULT 0,
  daily_profile_views int NOT NULL DEFAULT 0,
  daily_endorsements int NOT NULL DEFAULT 0,
  -- Configurable limits
  daily_connection_limit int NOT NULL DEFAULT 20,
  daily_message_limit int NOT NULL DEFAULT 50,
  weekly_connection_limit int NOT NULL DEFAULT 100,
  daily_profile_view_limit int NOT NULL DEFAULT 80,
  daily_endorsement_limit int NOT NULL DEFAULT 10,
  last_error text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linkedin_accounts_org_scope" ON linkedin_accounts
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TRIGGER set_linkedin_accounts_updated_at
  BEFORE UPDATE ON linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_org ON linkedin_accounts(organization_id);

-- ============================================================
-- 5. LINKEDIN ACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS linkedin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  step_id uuid REFERENCES sequence_steps(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('connect','message','inmail','view_profile','endorse')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','accepted','declined','replied','failed','pending')),
  -- Content fields
  connection_note text,
  message_body text,
  target_linkedin_url text,
  target_linkedin_id text,
  skill_name text,
  -- Response tracking
  response_body text,
  responded_at timestamptz,
  error_message text,
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linkedin_actions_org_scope" ON linkedin_actions
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_li_actions_lead ON linkedin_actions(lead_id);
CREATE INDEX IF NOT EXISTS idx_li_actions_enrollment ON linkedin_actions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_li_actions_status ON linkedin_actions(status) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_li_actions_type ON linkedin_actions(action_type);

-- ============================================================
-- 6. EXTEND SEQUENCE STEPS — channel_config for channel-specific settings
-- ============================================================
ALTER TABLE sequence_steps ADD COLUMN IF NOT EXISTS channel_config jsonb NOT NULL DEFAULT '{}';
-- channel_config stores:
-- For whatsapp: { template_id, template_params, message_type, media_url }
-- For linkedin_connect: { connection_note }
-- For linkedin_message: { message_body }
-- For linkedin_view: {}
-- For linkedin_endorse: { skill_name }

-- ============================================================
-- 7. EXTEND SEQUENCE ENROLLMENTS — channel account tracking
-- ============================================================
ALTER TABLE sequence_enrollments
  ADD COLUMN IF NOT EXISTS whatsapp_account_id uuid REFERENCES whatsapp_accounts(id),
  ADD COLUMN IF NOT EXISTS linkedin_account_id uuid REFERENCES linkedin_accounts(id);

-- ============================================================
-- DONE
-- ============================================================
