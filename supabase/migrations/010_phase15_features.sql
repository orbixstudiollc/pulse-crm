-- Phase 15: Additional Features

-- ═══════════════════════════════════════════════════════════════════
-- 15.1 Contact Intelligence
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contacts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id                 UUID REFERENCES leads(id) ON DELETE SET NULL,
  customer_id             UUID REFERENCES customers(id) ON DELETE SET NULL,
  name                    TEXT NOT NULL,
  title                   TEXT,
  email                   TEXT,
  phone                   TEXT,
  linkedin                TEXT,
  buying_role             TEXT DEFAULT 'end_user',
  influence_level         TEXT DEFAULT 'medium',
  personalization_anchors JSONB DEFAULT '[]',
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_org" ON contacts
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lead ON contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_role ON contacts(buying_role);

CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- 15.6 Smart Follow-up Reminders (alter leads)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_note TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- 15.7 Copy Library
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS copy_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'email_subject',
  name            TEXT NOT NULL,
  headline        TEXT,
  body            TEXT,
  cta             TEXT,
  tags            TEXT[] DEFAULT '{}',
  usage_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copy_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copy_templates_org" ON copy_templates
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_copy_templates_org ON copy_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_copy_templates_category ON copy_templates(category);

CREATE TRIGGER set_copy_templates_updated_at
  BEFORE UPDATE ON copy_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
