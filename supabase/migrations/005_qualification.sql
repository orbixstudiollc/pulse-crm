-- ============================================================
-- Phase 9: Lead Qualification System (BANT + MEDDIC)
-- ============================================================

-- ── Alter leads table for qualification ───────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS qualification_data  JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS qualification_grade TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS qualification_score INT DEFAULT NULL;

-- Index for qualification-based queries
CREATE INDEX IF NOT EXISTS idx_leads_qualification_grade
  ON leads(qualification_grade) WHERE qualification_grade IS NOT NULL;
