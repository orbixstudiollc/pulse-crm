-- Pre-042 baseline for the PGlite migration harness (tests/helpers/pglite.ts).
--
-- Recreates the shape of the tables migration 042 builds on, copied from the
-- repo migrations (not production):
--   organizations      001 + 022 (booking_*) + 026 (agency profile columns)
--   profiles           001
--   customers          001, reduced to id/organization_id: leads.converted_customer_id
--                      (037) needs a target; nothing here reads other columns
--   leads              001 + 003 + 004 + 005 + 010 + 022 + 037
--   icp_profiles       004
--   ai_settings        011 + 020 + 025 + 026 + 027 + 033
--   copilot_conversations, copilot_messages, copilot_memory, copilot_tasks   021
-- plus the org-membership RLS policies of 001, 004, 011 and 021.
--
-- Left out on purpose: the column-level grants of 030, the 031 role
-- predicates and the 038 budget objects. The harness bootstrap (auth schema,
-- auth.users, roles, update_updated_at) runs before this file.

CREATE TYPE lead_status AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE lead_source AS ENUM ('Website', 'Referral', 'LinkedIn', 'Event', 'Google Ads', 'Cold Call');

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  booking_url TEXT,
  booking_provider TEXT DEFAULT 'custom',
  agency_type        text,
  agency_description text,
  services           text,
  results_case_studies text,
  target_industries  text,
  agency_website     text
);

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT NOT NULL,
  phone           TEXT,
  job_title       TEXT,
  avatar_url      TEXT,
  role            TEXT DEFAULT 'member',
  timezone        TEXT DEFAULT 'pt',
  date_format     TEXT DEFAULT 'mm/dd/yyyy',
  time_format     TEXT DEFAULT '12h',
  language        TEXT DEFAULT 'en-us',
  notification_preferences JSONB DEFAULT '{
    "deal_updates": true,
    "new_leads": true,
    "task_reminders": true,
    "meeting_reminders": true,
    "weekly_summary": false,
    "marketing_emails": false
  }'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE icp_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
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
  weights         JSONB NOT NULL DEFAULT '{
    "industry": 25,
    "size": 20,
    "revenue": 15,
    "title": 15,
    "geography": 15,
    "tech": 10
  }'::jsonb,
  buyer_personas  JSONB NOT NULL DEFAULT '[]'::jsonb,
  color           TEXT DEFAULT '#6366f1',
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  company         TEXT,
  phone           TEXT,
  linkedin        TEXT,
  location        TEXT,
  employees       TEXT,
  website         TEXT,
  industry        TEXT,
  status          lead_status DEFAULT 'cold',
  source          lead_source DEFAULT 'Website',
  estimated_value NUMERIC(12,2) DEFAULT 0,
  score           INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  win_probability INTEGER DEFAULT 0 CHECK (win_probability >= 0 AND win_probability <= 100),
  days_in_pipeline INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  -- 003
  score_breakdown  JSONB DEFAULT NULL,
  last_scored_at   TIMESTAMPTZ DEFAULT NULL,
  engagement_score INT DEFAULT 0,
  -- 004
  icp_match_score     INT DEFAULT NULL,
  icp_profile_id      UUID REFERENCES icp_profiles(id) ON DELETE SET NULL,
  icp_match_breakdown JSONB DEFAULT NULL,
  -- 005
  qualification_data  JSONB DEFAULT NULL,
  qualification_grade TEXT DEFAULT NULL,
  qualification_score INT DEFAULT NULL,
  -- 010
  next_followup DATE,
  followup_note TEXT,
  -- 022
  assigned_to UUID REFERENCES auth.users(id),
  status_changed_at TIMESTAMPTZ DEFAULT now(),
  last_engagement_at TIMESTAMPTZ,
  -- 037
  converted_at TIMESTAMPTZ,
  converted_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX idx_leads_org ON leads(organization_id);
CREATE INDEX idx_leads_status ON leads(organization_id, status);
CREATE INDEX idx_leads_source ON leads(organization_id, source);
CREATE INDEX idx_leads_icp_profile ON leads(icp_profile_id) WHERE icp_profile_id IS NOT NULL;
CREATE INDEX idx_leads_qualification_grade ON leads(qualification_grade) WHERE qualification_grade IS NOT NULL;
CREATE INDEX idx_leads_converted_at ON leads(organization_id, converted_at);

CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key TEXT,
  default_model TEXT NOT NULL DEFAULT 'sonnet',
  feature_lead_scoring BOOLEAN NOT NULL DEFAULT true,
  feature_icp_matching BOOLEAN NOT NULL DEFAULT true,
  feature_outreach BOOLEAN NOT NULL DEFAULT true,
  feature_proposals BOOLEAN NOT NULL DEFAULT true,
  feature_meetings BOOLEAN NOT NULL DEFAULT true,
  feature_analytics BOOLEAN NOT NULL DEFAULT true,
  feature_competitors BOOLEAN NOT NULL DEFAULT true,
  feature_objections BOOLEAN NOT NULL DEFAULT true,
  feature_chat BOOLEAN NOT NULL DEFAULT true,
  autonomy_lead_scoring TEXT NOT NULL DEFAULT 'suggest',
  autonomy_icp_matching TEXT NOT NULL DEFAULT 'suggest',
  autonomy_outreach TEXT NOT NULL DEFAULT 'suggest',
  autonomy_proposals TEXT NOT NULL DEFAULT 'suggest',
  autonomy_meetings TEXT NOT NULL DEFAULT 'suggest',
  autonomy_analytics TEXT NOT NULL DEFAULT 'suggest',
  autonomy_competitors TEXT NOT NULL DEFAULT 'suggest',
  autonomy_objections TEXT NOT NULL DEFAULT 'suggest',
  tokens_used_today INTEGER NOT NULL DEFAULT 0,
  tokens_used_month INTEGER NOT NULL DEFAULT 0,
  daily_token_limit INTEGER NOT NULL DEFAULT 100000,
  monthly_token_limit INTEGER NOT NULL DEFAULT 2000000,
  last_token_reset_daily TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_token_reset_monthly TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 020
  feature_marketing BOOLEAN DEFAULT true,
  -- 025
  openai_api_key TEXT,
  -- 026
  parallel_enrichment_limit integer NOT NULL DEFAULT 1,
  -- 027
  apify_api_key              text,
  openrouter_api_key         text,
  openrouter_oauth_token     text,
  openrouter_code_verifier   text,
  openrouter_expires_at      timestamptz,
  groq_api_key               text,
  ollama_base_url            text,
  ai_provider                text,
  obsidian_vault_path        text,
  obsidian_sync_enabled      boolean NOT NULL DEFAULT false,
  -- 033
  custom_base_url   text,
  custom_api_key    text,
  custom_model      text,
  custom_fast_model text,
  UNIQUE(organization_id),
  CONSTRAINT ai_settings_ai_provider_check CHECK (
    ai_provider IS NULL OR ai_provider IN (
      'anthropic', 'openai', 'openrouter', 'groq', 'ollama', 'ollama_cloud', 'custom'
    )
  )
);

CREATE TABLE copilot_conversations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text DEFAULT 'New Chat'::text NOT NULL,
  summary text,
  is_pinned boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT copilot_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT copilot_conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT copilot_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE copilot_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conversation_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  tool_calls jsonb,
  tool_results jsonb,
  tokens_used integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT copilot_messages_pkey PRIMARY KEY (id),
  CONSTRAINT copilot_messages_role_check CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  CONSTRAINT copilot_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  CONSTRAINT copilot_messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE copilot_memory (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  source text,
  source_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT copilot_memory_pkey PRIMARY KEY (id),
  CONSTRAINT copilot_memory_source_check CHECK (source = ANY (ARRAY['manual'::text, 'website'::text, 'file'::text])),
  CONSTRAINT copilot_memory_type_check CHECK (type = ANY (ARRAY['business_details'::text, 'product_info'::text, 'target_audience'::text, 'brand_voice'::text, 'custom'::text])),
  CONSTRAINT copilot_memory_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT copilot_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE copilot_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  prompt text NOT NULL,
  schedule text NOT NULL,
  cron_expression text,
  is_active boolean DEFAULT true,
  last_run_at timestamp with time zone,
  next_run_at timestamp with time zone,
  run_count integer DEFAULT 0,
  last_result text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT copilot_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT copilot_tasks_schedule_check CHECK (schedule = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'custom'::text])),
  CONSTRAINT copilot_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT copilot_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ─── Triggers ────────────────────────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ai_settings_updated_at BEFORE UPDATE ON ai_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_copilot_conversations_updated_at BEFORE UPDATE ON copilot_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_copilot_memory_updated_at BEFORE UPDATE ON copilot_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_copilot_tasks_updated_at BEFORE UPDATE ON copilot_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row level security (org-membership policies) ────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_tasks ENABLE ROW LEVEL SECURITY;

-- 001
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Org members can view" ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Authenticated users can create orgs" ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Org members can update" ON organizations FOR UPDATE
  USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can manage leads" ON leads FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 004
CREATE POLICY "icp_profiles_org" ON icp_profiles FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 011
CREATE POLICY "Users can view their org AI settings" ON ai_settings FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert their org AI settings" ON ai_settings FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update their org AI settings" ON ai_settings FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Service role full access to ai_settings" ON ai_settings FOR ALL
  USING (auth.role() = 'service_role');

-- 021
CREATE POLICY org_access ON copilot_conversations FOR ALL TO public
  USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()));
CREATE POLICY org_access ON copilot_memory FOR ALL TO public
  USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()));
CREATE POLICY org_access ON copilot_messages FOR ALL TO public
  USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()));
CREATE POLICY org_access ON copilot_tasks FOR ALL TO public
  USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()));
