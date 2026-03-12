-- Phase 12: Objection Playbook
-- Stores objection handling scripts using FFR (Feel-Felt-Found) and ABC (Acknowledge-Bridge-Close) frameworks

CREATE TABLE IF NOT EXISTS objection_playbook (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'pricing',
  objection_text  TEXT NOT NULL,
  hidden_meaning  TEXT,
  ffr_response    TEXT,
  abc_response    TEXT,
  follow_up_question TEXT,
  proof_point     TEXT,
  walk_away_criteria TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE objection_playbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objection_playbook_org" ON objection_playbook
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_objection_playbook_org ON objection_playbook(organization_id);
CREATE INDEX IF NOT EXISTS idx_objection_playbook_category ON objection_playbook(category);

CREATE TRIGGER set_objection_playbook_updated_at
  BEFORE UPDATE ON objection_playbook
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
