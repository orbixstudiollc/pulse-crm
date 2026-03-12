-- ============================================================
-- Phase 10: Outreach Sequences
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE sequence_status AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('active', 'paused', 'completed', 'replied', 'bounced', 'unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── sequences ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sequences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  status          sequence_status NOT NULL DEFAULT 'draft',
  category        TEXT NOT NULL DEFAULT 'cold_outreach',
  total_steps     INT NOT NULL DEFAULT 0,
  total_enrolled  INT NOT NULL DEFAULT 0,
  reply_rate      NUMERIC(5,2) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequences_org" ON sequences
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── sequence_steps ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sequence_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order  INT NOT NULL DEFAULT 1,
  step_type   TEXT NOT NULL DEFAULT 'email',
  delay_days  INT NOT NULL DEFAULT 0,
  subject     TEXT,
  body        TEXT,
  channel     TEXT DEFAULT 'email',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequence_steps_via_sequence" ON sequence_steps
  FOR ALL USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence
  ON sequence_steps(sequence_id, step_order);

-- ── email_templates ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general',
  merge_fields    TEXT[] NOT NULL DEFAULT '{}',
  usage_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_org" ON email_templates
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── sequence_enrollments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  current_step  INT NOT NULL DEFAULT 1,
  status        enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  paused_at     TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, lead_id)
);

ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequence_enrollments_via_sequence" ON sequence_enrollments
  FOR ALL USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_lead
  ON sequence_enrollments(lead_id);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence
  ON sequence_enrollments(sequence_id, status);

-- ── sequence_events ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sequence_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_id       UUID REFERENCES sequence_steps(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sequence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequence_events_via_enrollment" ON sequence_events
  FOR ALL USING (
    enrollment_id IN (
      SELECT id FROM sequence_enrollments WHERE sequence_id IN (
        SELECT id FROM sequences WHERE organization_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_sequence_events_enrollment
  ON sequence_events(enrollment_id, created_at DESC);

-- ── Triggers for updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_sequences_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sequences_updated_at
  BEFORE UPDATE ON sequences FOR EACH ROW
  EXECUTE FUNCTION update_sequences_updated_at();

CREATE TRIGGER sequence_steps_updated_at
  BEFORE UPDATE ON sequence_steps FOR EACH ROW
  EXECUTE FUNCTION update_sequences_updated_at();

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates FOR EACH ROW
  EXECUTE FUNCTION update_sequences_updated_at();

CREATE TRIGGER sequence_enrollments_updated_at
  BEFORE UPDATE ON sequence_enrollments FOR EACH ROW
  EXECUTE FUNCTION update_sequences_updated_at();
