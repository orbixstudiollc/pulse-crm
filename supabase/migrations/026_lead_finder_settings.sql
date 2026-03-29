-- Lead Finder Settings: agency profile fields + enrichment concurrency limit

-- Agency profile details on organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS agency_type        text,
  ADD COLUMN IF NOT EXISTS agency_description text,
  ADD COLUMN IF NOT EXISTS services           text,
  ADD COLUMN IF NOT EXISTS results_case_studies text,
  ADD COLUMN IF NOT EXISTS target_industries  text,
  ADD COLUMN IF NOT EXISTS agency_website     text;

-- Parallel enrichment limit on ai_settings
ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS parallel_enrichment_limit integer NOT NULL DEFAULT 1;
