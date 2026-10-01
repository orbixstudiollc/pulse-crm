-- ============================================================
-- 037 leads.converted_at / converted_customer_id: keep converted leads
--
-- "Convert to Customer" used to create the customer and then delete the lead,
-- which cascaded away the lead's notes, activities, score history, sequence
-- enrollments and campaign memberships, and left nothing to count as
-- "converted". When the lead came from Lead Finder, lf_leads.imported_lead_id
-- (NO ACTION) blocked the delete and the error was ignored, leaving both a
-- lead and a customer for the same person.
--
-- The app now keeps the lead and stamps it: converted_at is when it was
-- converted and converted_customer_id points at the customer it became. The
-- Leads list hides converted leads and counts them in its "Converted" stat;
-- the lead's page links to its customer.
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS converted_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_converted_at ON leads(organization_id, converted_at);
