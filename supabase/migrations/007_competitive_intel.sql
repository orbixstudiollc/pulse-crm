-- ============================================================
-- Phase 11: Competitive Intelligence
-- ============================================================

-- ── competitors ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  website         TEXT,
  category        TEXT NOT NULL DEFAULT 'direct',
  description     TEXT,
  strengths       TEXT[] NOT NULL DEFAULT '{}',
  weaknesses      TEXT[] NOT NULL DEFAULT '{}',
  pricing         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitors_org" ON competitors
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── battle_cards ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS battle_cards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id         UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  their_strengths       TEXT[] NOT NULL DEFAULT '{}',
  their_weaknesses      TEXT[] NOT NULL DEFAULT '{}',
  our_advantages        TEXT[] NOT NULL DEFAULT '{}',
  switching_costs       JSONB DEFAULT '{}',
  switching_triggers    TEXT[] NOT NULL DEFAULT '{}',
  landmine_questions    TEXT[] NOT NULL DEFAULT '{}',
  positioning_statement TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE battle_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "battle_cards_via_competitor" ON battle_cards
  FOR ALL USING (
    competitor_id IN (
      SELECT id FROM competitors WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ── lead_competitors ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_competitors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  confidence    TEXT NOT NULL DEFAULT 'medium',
  evidence      TEXT,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, competitor_id)
);

ALTER TABLE lead_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_competitors_via_lead" ON lead_competitors
  FOR ALL USING (
    lead_id IN (
      SELECT id FROM leads WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_lead_competitors_lead ON lead_competitors(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_competitors_competitor ON lead_competitors(competitor_id);

-- ── Triggers for updated_at ───────────────────────────────────
CREATE TRIGGER competitors_updated_at
  BEFORE UPDATE ON competitors FOR EACH ROW
  EXECUTE FUNCTION update_sequences_updated_at();

CREATE TRIGGER battle_cards_updated_at
  BEFORE UPDATE ON battle_cards FOR EACH ROW
  EXECUTE FUNCTION update_sequences_updated_at();
