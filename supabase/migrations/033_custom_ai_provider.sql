-- ============================================================
-- 033 Custom Anthropic-compatible AI provider
--
-- Adds the provider value 'custom': an org-configured Anthropic-compatible
-- endpoint (e.g. LLMsRelay).
--
--   custom_base_url    endpoint origin plus optional path, without /v1
--   custom_api_key     SEALED with encrypt() (lib/utils/encryption.ts),
--                      never plaintext; a secret column
--   custom_model       model for the sonnet tier and the default
--   custom_fast_model  optional model for the haiku tier
--
-- Provider allowlists: 'custom' is added to the value lists from
-- 027_lead_finder_parity.sql (ai_settings, lf_campaigns, lf_llm_costs).
--
-- Column grants follow 030_followup.sql: authenticated may SELECT the three
-- non-secret columns but NOT custom_api_key (server code reads it with the
-- service role); UPDATE/INSERT are granted on all four, like the other
-- (write-only) secret columns.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS + ADD,
-- and GRANTs are idempotent. Apply by hand in the Supabase SQL editor.
-- ============================================================

BEGIN;

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS custom_base_url   text,
  ADD COLUMN IF NOT EXISTS custom_api_key    text,
  ADD COLUMN IF NOT EXISTS custom_model      text,
  ADD COLUMN IF NOT EXISTS custom_fast_model text;


-- ─── Provider allowlists: add 'custom' ──────────────────────────────────────

ALTER TABLE public.ai_settings
  DROP CONSTRAINT IF EXISTS ai_settings_ai_provider_check;

ALTER TABLE public.ai_settings
  ADD CONSTRAINT ai_settings_ai_provider_check
  CHECK (
    ai_provider IS NULL OR ai_provider IN (
      'anthropic', 'openai', 'openrouter', 'groq', 'ollama', 'ollama_cloud', 'custom'
    )
  );

ALTER TABLE public.lf_campaigns
  DROP CONSTRAINT IF EXISTS lf_campaigns_ai_provider_check;

ALTER TABLE public.lf_campaigns
  ADD CONSTRAINT lf_campaigns_ai_provider_check
  CHECK (ai_provider IN (
    'anthropic', 'openai', 'openrouter', 'groq', 'ollama', 'ollama_cloud', 'custom'
  ));

ALTER TABLE public.lf_llm_costs
  DROP CONSTRAINT IF EXISTS lf_llm_costs_provider_check;

ALTER TABLE public.lf_llm_costs
  ADD CONSTRAINT lf_llm_costs_provider_check
  CHECK (provider IN (
    'openai', 'anthropic', 'openrouter', 'groq', 'ollama', 'ollama_cloud', 'minimax', 'custom'
  ));


-- ─── Column grants (see 030) ────────────────────────────────────────────────
-- 030 replaced the table-level grants with column lists, so new columns get
-- no privileges until granted here. custom_api_key is deliberately absent
-- from SELECT.

GRANT SELECT (custom_base_url, custom_model, custom_fast_model)
  ON public.ai_settings TO authenticated;

GRANT UPDATE (custom_base_url, custom_api_key, custom_model, custom_fast_model)
  ON public.ai_settings TO authenticated;

GRANT INSERT (custom_base_url, custom_api_key, custom_model, custom_fast_model)
  ON public.ai_settings TO authenticated;

COMMIT;
