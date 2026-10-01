-- ============================================================
-- 021 Tables that existed only in production
--
-- These 13 tables were created by hand in the Supabase dashboard and had no
-- migration, so a fresh database could not be built from the repo:
--
--   apify_scraper_runs, campaign_tags, copilot_conversations, copilot_memory,
--   copilot_messages, copilot_tasks, lead_searches, scraped_leads,
--   sequence_email_accounts, sequence_tags, tracking_scripts,
--   website_visitors, website_visits
--
-- Columns, constraints, indexes, RLS, policies and triggers are copied from
-- the production catalog on 2026-10-01. Nothing is changed: on production
-- every statement is a no-op, so this is safe to apply there too.
--
-- Numbered 021 so it runs before 022_automation_rules.sql (formerly
-- 20260313_automation_rules.sql), which alters lead_searches and
-- scraped_leads. 022 and 023 were renamed from their 20260313_ names because
-- 028, 030 and 031 depend on them, and the old names sorted after 034.
--
-- Idempotent. Constraints and policies are added only when one with the same
-- name is not already on the table.
-- ============================================================

CREATE OR REPLACE FUNCTION pg_temp.add_constraint(tbl regclass, name text, def text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = tbl AND conname = name) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', tbl, name, def);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.add_policy(tbl regclass, name text, def text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = tbl AND polname = name) THEN
    EXECUTE format('CREATE POLICY %I ON %s %s', name, tbl, def);
  END IF;
END $$;

-- ─── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lead_searches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  created_by uuid,
  name text NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb NOT NULL,
  result_count integer DEFAULT 0,
  last_run_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_recurring boolean DEFAULT false,
  schedule_frequency text DEFAULT 'daily'::text,
  next_run_at timestamp with time zone,
  auto_import boolean DEFAULT false,
  auto_enroll_sequence_id uuid
);

CREATE TABLE IF NOT EXISTS public.apify_scraper_runs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  search_id uuid,
  created_by uuid,
  actor_id text NOT NULL,
  source text NOT NULL,
  input_params jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  apify_run_id text,
  apify_dataset_id text,
  result_count integer DEFAULT 0,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.scraped_leads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  search_id uuid,
  first_name text,
  last_name text,
  email text,
  title text,
  company text,
  industry text,
  location text,
  linkedin_url text,
  company_website text,
  company_size text,
  phone text,
  verified boolean DEFAULT false,
  imported boolean DEFAULT false,
  imported_lead_id uuid,
  source text DEFAULT 'search'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  icp_match_score integer,
  ai_quality_score integer,
  verification_status text DEFAULT 'unverified'::text,
  verified_at timestamp with time zone,
  duplicate_of uuid,
  confidence_score numeric(3,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.campaign_tags (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sequence_tags (
  sequence_id uuid NOT NULL,
  tag_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sequence_email_accounts (
  sequence_id uuid NOT NULL,
  email_account_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.copilot_conversations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text DEFAULT 'New Chat'::text NOT NULL,
  summary text,
  is_pinned boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conversation_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  tool_calls jsonb,
  tool_results jsonb,
  tokens_used integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.copilot_memory (
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
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.copilot_tasks (
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
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tracking_scripts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  domain text NOT NULL,
  script_key uuid DEFAULT gen_random_uuid() NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.website_visitors (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  script_id uuid,
  session_id text,
  ip_address text,
  company_name text,
  company_domain text,
  city text,
  region text,
  country text,
  country_code text,
  first_seen timestamp with time zone DEFAULT now() NOT NULL,
  last_seen timestamp with time zone DEFAULT now() NOT NULL,
  visit_count integer DEFAULT 1 NOT NULL,
  page_count integer DEFAULT 0 NOT NULL,
  total_duration integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'new'::text NOT NULL,
  lead_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.website_visits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  visitor_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  page_url text NOT NULL,
  page_title text,
  referrer text,
  duration integer DEFAULT 0,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Primary keys, unique and check constraints ──────────────

SELECT pg_temp.add_constraint('public.apify_scraper_runs', 'apify_scraper_runs_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.campaign_tags', 'campaign_tags_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.copilot_conversations', 'copilot_conversations_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.copilot_memory', 'copilot_memory_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.copilot_messages', 'copilot_messages_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.copilot_tasks', 'copilot_tasks_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.lead_searches', 'lead_searches_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.scraped_leads', 'scraped_leads_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.sequence_email_accounts', 'sequence_email_accounts_pkey', 'PRIMARY KEY (sequence_id, email_account_id)');
SELECT pg_temp.add_constraint('public.sequence_tags', 'sequence_tags_pkey', 'PRIMARY KEY (sequence_id, tag_id)');
SELECT pg_temp.add_constraint('public.tracking_scripts', 'tracking_scripts_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.website_visitors', 'website_visitors_pkey', 'PRIMARY KEY (id)');
SELECT pg_temp.add_constraint('public.website_visits', 'website_visits_pkey', 'PRIMARY KEY (id)');

SELECT pg_temp.add_constraint('public.tracking_scripts', 'tracking_scripts_organization_id_domain_key', 'UNIQUE (organization_id, domain)');

SELECT pg_temp.add_constraint('public.copilot_memory', 'copilot_memory_source_check',
  $c$CHECK (source = ANY (ARRAY['manual'::text, 'website'::text, 'file'::text]))$c$);
SELECT pg_temp.add_constraint('public.copilot_memory', 'copilot_memory_type_check',
  $c$CHECK (type = ANY (ARRAY['business_details'::text, 'product_info'::text, 'target_audience'::text, 'brand_voice'::text, 'custom'::text]))$c$);
SELECT pg_temp.add_constraint('public.copilot_messages', 'copilot_messages_role_check',
  $c$CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text]))$c$);
SELECT pg_temp.add_constraint('public.copilot_tasks', 'copilot_tasks_schedule_check',
  $c$CHECK (schedule = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'custom'::text]))$c$);
SELECT pg_temp.add_constraint('public.website_visitors', 'website_visitors_status_check',
  $c$CHECK (status = ANY (ARRAY['new'::text, 'returning'::text, 'hot'::text, 'converted'::text, 'ignored'::text]))$c$);

-- ─── Foreign keys ────────────────────────────────────────────

SELECT pg_temp.add_constraint('public.apify_scraper_runs', 'apify_scraper_runs_created_by_fkey', 'FOREIGN KEY (created_by) REFERENCES auth.users(id)');
SELECT pg_temp.add_constraint('public.apify_scraper_runs', 'apify_scraper_runs_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.apify_scraper_runs', 'apify_scraper_runs_search_id_fkey', 'FOREIGN KEY (search_id) REFERENCES public.lead_searches(id) ON DELETE SET NULL');
SELECT pg_temp.add_constraint('public.campaign_tags', 'campaign_tags_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id)');
SELECT pg_temp.add_constraint('public.copilot_conversations', 'copilot_conversations_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.copilot_conversations', 'copilot_conversations_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id)');
SELECT pg_temp.add_constraint('public.copilot_memory', 'copilot_memory_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.copilot_memory', 'copilot_memory_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id)');
SELECT pg_temp.add_constraint('public.copilot_messages', 'copilot_messages_conversation_id_fkey', 'FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.copilot_messages', 'copilot_messages_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.copilot_tasks', 'copilot_tasks_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.copilot_tasks', 'copilot_tasks_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id)');
SELECT pg_temp.add_constraint('public.lead_searches', 'lead_searches_auto_enroll_sequence_id_fkey', 'FOREIGN KEY (auto_enroll_sequence_id) REFERENCES public.sequences(id)');
SELECT pg_temp.add_constraint('public.lead_searches', 'lead_searches_created_by_fkey', 'FOREIGN KEY (created_by) REFERENCES public.profiles(id)');
SELECT pg_temp.add_constraint('public.lead_searches', 'lead_searches_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id)');
SELECT pg_temp.add_constraint('public.scraped_leads', 'scraped_leads_duplicate_of_fkey', 'FOREIGN KEY (duplicate_of) REFERENCES public.leads(id)');
SELECT pg_temp.add_constraint('public.scraped_leads', 'scraped_leads_imported_lead_id_fkey', 'FOREIGN KEY (imported_lead_id) REFERENCES public.leads(id)');
SELECT pg_temp.add_constraint('public.scraped_leads', 'scraped_leads_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id)');
SELECT pg_temp.add_constraint('public.scraped_leads', 'scraped_leads_search_id_fkey', 'FOREIGN KEY (search_id) REFERENCES public.lead_searches(id) ON DELETE SET NULL');
SELECT pg_temp.add_constraint('public.sequence_email_accounts', 'sequence_email_accounts_email_account_id_fkey', 'FOREIGN KEY (email_account_id) REFERENCES public.email_accounts(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.sequence_email_accounts', 'sequence_email_accounts_sequence_id_fkey', 'FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.sequence_tags', 'sequence_tags_sequence_id_fkey', 'FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.sequence_tags', 'sequence_tags_tag_id_fkey', 'FOREIGN KEY (tag_id) REFERENCES public.campaign_tags(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.tracking_scripts', 'tracking_scripts_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.website_visitors', 'website_visitors_lead_id_fkey', 'FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL');
SELECT pg_temp.add_constraint('public.website_visitors', 'website_visitors_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.website_visitors', 'website_visitors_script_id_fkey', 'FOREIGN KEY (script_id) REFERENCES public.tracking_scripts(id) ON DELETE SET NULL');
SELECT pg_temp.add_constraint('public.website_visits', 'website_visits_organization_id_fkey', 'FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE');
SELECT pg_temp.add_constraint('public.website_visits', 'website_visits_visitor_id_fkey', 'FOREIGN KEY (visitor_id) REFERENCES public.website_visitors(id) ON DELETE CASCADE');

-- ─── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_website_visitors_last_seen ON public.website_visitors USING btree (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_website_visitors_org ON public.website_visitors USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_website_visitors_status ON public.website_visitors USING btree (status);
CREATE INDEX IF NOT EXISTS idx_website_visits_created ON public.website_visits USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_visits_org ON public.website_visits USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_website_visits_visitor ON public.website_visits USING btree (visitor_id);

-- ─── Row level security ──────────────────────────────────────

ALTER TABLE public.apify_scraper_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_visits ENABLE ROW LEVEL SECURITY;

-- ─── Policies ────────────────────────────────────────────────
-- Every policy limits rows to the caller's organization, as in production.

SELECT pg_temp.add_policy('public.apify_scraper_runs', 'org_access',
  $p$FOR ALL TO public USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.copilot_conversations', 'org_access',
  $p$FOR ALL TO public USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.copilot_memory', 'org_access',
  $p$FOR ALL TO public USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.copilot_messages', 'org_access',
  $p$FOR ALL TO public USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.copilot_tasks', 'org_access',
  $p$FOR ALL TO public USING (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);

SELECT pg_temp.add_policy('public.campaign_tags', 'Users can view own org campaign_tags',
  $p$FOR SELECT TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.campaign_tags', 'Users can insert own org campaign_tags',
  $p$FOR INSERT TO public WITH CHECK (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.campaign_tags', 'Users can delete own org campaign_tags',
  $p$FOR DELETE TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);

SELECT pg_temp.add_policy('public.lead_searches', 'Users can view own org lead_searches',
  $p$FOR SELECT TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.lead_searches', 'Users can insert own org lead_searches',
  $p$FOR INSERT TO public WITH CHECK (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.lead_searches', 'Users can update own org lead_searches',
  $p$FOR UPDATE TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.lead_searches', 'Users can delete own org lead_searches',
  $p$FOR DELETE TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);

SELECT pg_temp.add_policy('public.scraped_leads', 'Users can view own org scraped_leads',
  $p$FOR SELECT TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.scraped_leads', 'Users can insert own org scraped_leads',
  $p$FOR INSERT TO public WITH CHECK (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.scraped_leads', 'Users can update own org scraped_leads',
  $p$FOR UPDATE TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.scraped_leads', 'Users can delete own org scraped_leads',
  $p$FOR DELETE TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);

SELECT pg_temp.add_policy('public.sequence_email_accounts', 'Users can manage sequence_email_accounts',
  $p$FOR ALL TO public USING (sequence_id IN (SELECT sequences.id FROM public.sequences WHERE sequences.organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())))$p$);
SELECT pg_temp.add_policy('public.sequence_tags', 'Users can manage sequence_tags',
  $p$FOR ALL TO public USING (sequence_id IN (SELECT sequences.id FROM public.sequences WHERE sequences.organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid())))$p$);

SELECT pg_temp.add_policy('public.tracking_scripts', 'Users can manage own org tracking scripts',
  $p$FOR ALL TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.website_visitors', 'Users can manage own org visitors',
  $p$FOR ALL TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);
SELECT pg_temp.add_policy('public.website_visits', 'Users can view own org visits',
  $p$FOR ALL TO public USING (organization_id IN (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))$p$);

-- ─── updated_at triggers (update_updated_at() is defined in 001) ───

CREATE OR REPLACE TRIGGER update_copilot_conversations_updated_at BEFORE UPDATE ON public.copilot_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER update_copilot_memory_updated_at BEFORE UPDATE ON public.copilot_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER update_copilot_tasks_updated_at BEFORE UPDATE ON public.copilot_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER update_lead_searches_updated_at BEFORE UPDATE ON public.lead_searches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER set_tracking_scripts_updated_at BEFORE UPDATE ON public.tracking_scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER set_website_visitors_updated_at BEFORE UPDATE ON public.website_visitors FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'migration 021 applied' AS result;
