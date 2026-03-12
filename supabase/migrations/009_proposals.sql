-- Phase 13: Proposals
CREATE TABLE IF NOT EXISTS proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  content         JSONB DEFAULT '{}',
  pricing_tiers   JSONB DEFAULT '[]',
  valid_until     DATE,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_org" ON proposals
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_proposals_org ON proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposals_deal ON proposals(deal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

CREATE TRIGGER set_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
