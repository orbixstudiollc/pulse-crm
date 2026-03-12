-- ============================================================
-- Pulse CRM — Initial Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE customer_status AS ENUM ('active', 'pending', 'inactive');
CREATE TYPE customer_plan AS ENUM ('enterprise', 'pro', 'starter', 'free');
CREATE TYPE lead_status AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE lead_source AS ENUM ('Website', 'Referral', 'LinkedIn', 'Event', 'Google Ads', 'Cold Call');
CREATE TYPE deal_stage AS ENUM ('discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
CREATE TYPE activity_type AS ENUM ('call', 'meeting', 'task', 'email', 'note');
CREATE TYPE activity_status AS ENUM ('completed', 'scheduled', 'pending', 'cancelled');
CREATE TYPE related_entity_type AS ENUM ('deal', 'customer', 'lead');

-- ============================================================
-- ORGANIZATIONS (multi-tenancy root)
-- ============================================================

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

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
  -- Preferences
  timezone        TEXT DEFAULT 'pt',
  date_format     TEXT DEFAULT 'mm/dd/yyyy',
  time_format     TEXT DEFAULT '12h',
  language        TEXT DEFAULT 'en-us',
  -- Notification preferences
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

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  status          customer_status DEFAULT 'active',
  plan            customer_plan DEFAULT 'free',
  mrr             NUMERIC(12,2) DEFAULT 0,
  health_score    INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
  lifetime_value  NUMERIC(14,2) DEFAULT 0,
  tenure          INTEGER DEFAULT 0,
  last_contact    TIMESTAMPTZ,
  company         TEXT,
  job_title       TEXT,
  industry        TEXT,
  company_size    TEXT,
  website         TEXT,
  street_address  TEXT,
  city            TEXT,
  state           TEXT,
  postal_code     TEXT,
  country         TEXT DEFAULT 'us',
  timezone        TEXT,
  customer_since  DATE,
  renewal_date    DATE,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customers_org ON customers(organization_id);
CREATE INDEX idx_customers_status ON customers(organization_id, status);
CREATE INDEX idx_customers_email ON customers(organization_id, email);

-- ============================================================
-- CUSTOMER CUSTOM FIELDS
-- ============================================================

CREATE TABLE customer_custom_fields (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  value       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_custom_fields_customer ON customer_custom_fields(customer_id);

-- ============================================================
-- CUSTOMER NOTES
-- ============================================================

CREATE TABLE customer_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_notes_customer ON customer_notes(customer_id);

-- ============================================================
-- CUSTOMER ACTIVITY LOG
-- ============================================================

CREATE TABLE customer_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  badge_label TEXT,
  badge_variant TEXT,
  meta        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_activities_customer ON customer_activities(customer_id);

-- ============================================================
-- LEADS
-- ============================================================

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
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_leads_org ON leads(organization_id);
CREATE INDEX idx_leads_status ON leads(organization_id, status);
CREATE INDEX idx_leads_source ON leads(organization_id, source);

-- ============================================================
-- LEAD NOTES
-- ============================================================

CREATE TABLE lead_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_notes_lead ON lead_notes(lead_id);

-- ============================================================
-- LEAD ACTIVITIES
-- ============================================================

CREATE TABLE lead_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  badge_label TEXT,
  badge_variant TEXT,
  meta        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id);

-- ============================================================
-- DEALS (Pipeline)
-- ============================================================

CREATE TABLE deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  company         TEXT,
  value           NUMERIC(14,2) DEFAULT 0,
  probability     INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  stage           deal_stage DEFAULT 'discovery',
  close_date      DATE,
  owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  days_in_stage   INTEGER DEFAULT 0,
  days_to_close   INTEGER DEFAULT 0,
  last_activity   TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_avatar  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deals_org ON deals(organization_id);
CREATE INDEX idx_deals_stage ON deals(organization_id, stage);
CREATE INDEX idx_deals_customer ON deals(customer_id);
CREATE INDEX idx_deals_owner ON deals(owner_id);

-- ============================================================
-- DEAL NOTES
-- ============================================================

CREATE TABLE deal_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deal_notes_deal ON deal_notes(deal_id);

-- ============================================================
-- DEAL ACTIVITIES
-- ============================================================

CREATE TABLE deal_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  badge_label TEXT,
  badge_variant TEXT,
  meta        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deal_activities_deal ON deal_activities(deal_id);

-- ============================================================
-- ACTIVITIES (Global activity log)
-- ============================================================

CREATE TABLE activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type            activity_type NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          activity_status DEFAULT 'pending',
  date            DATE,
  time            TEXT,
  assignee        TEXT,
  related_type    related_entity_type,
  related_name    TEXT,
  related_id      UUID,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activities_org ON activities(organization_id);
CREATE INDEX idx_activities_type ON activities(organization_id, type);
CREATE INDEX idx_activities_status ON activities(organization_id, status);
CREATE INDEX idx_activities_related ON activities(related_type, related_id);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================

CREATE TABLE calendar_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  date            DATE NOT NULL,
  start_time      TEXT,
  end_time        TEXT,
  type            TEXT DEFAULT 'meeting',
  status          TEXT DEFAULT 'scheduled',
  related_type    related_entity_type,
  related_name    TEXT,
  related_id      UUID,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calendar_org ON calendar_events(organization_id);
CREATE INDEX idx_calendar_date ON calendar_events(organization_id, date);

-- ============================================================
-- USER INTEGRATIONS
-- ============================================================

CREATE TABLE user_integrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_name TEXT NOT NULL,
  connected        BOOLEAN DEFAULT false,
  config           JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, integration_name)
);

CREATE INDEX idx_integrations_user ON user_integrations(user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customer_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ORGANIZATIONS
CREATE POLICY "Org members can view"
  ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Authenticated users can create orgs"
  ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Org members can update"
  ON organizations FOR UPDATE
  USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- CUSTOMERS (org-scoped CRUD)
CREATE POLICY "Org members can view customers"
  ON customers FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can insert customers"
  ON customers FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can update customers"
  ON customers FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can delete customers"
  ON customers FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- CUSTOMER CHILD TABLES (cascaded through parent)
CREATE POLICY "Access customer custom fields"
  ON customer_custom_fields FOR ALL
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Access customer notes"
  ON customer_notes FOR ALL
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Access customer activities"
  ON customer_activities FOR ALL
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- LEADS (org-scoped)
CREATE POLICY "Org members can manage leads"
  ON leads FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- LEAD CHILD TABLES
CREATE POLICY "Access lead notes"
  ON lead_notes FOR ALL
  USING (lead_id IN (SELECT id FROM leads WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Access lead activities"
  ON lead_activities FOR ALL
  USING (lead_id IN (SELECT id FROM leads WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- DEALS (org-scoped)
CREATE POLICY "Org members can manage deals"
  ON deals FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- DEAL CHILD TABLES
CREATE POLICY "Access deal notes"
  ON deal_notes FOR ALL
  USING (deal_id IN (SELECT id FROM deals WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Access deal activities"
  ON deal_activities FOR ALL
  USING (deal_id IN (SELECT id FROM deals WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- ACTIVITIES (org-scoped)
CREATE POLICY "Org members can manage activities"
  ON activities FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- CALENDAR EVENTS (org-scoped)
CREATE POLICY "Org members can manage calendar events"
  ON calendar_events FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- USER INTEGRATIONS (user-scoped)
CREATE POLICY "Users manage own integrations"
  ON user_integrations FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
