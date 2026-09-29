-- ============================================================
-- 030 Follow-up hardening
--
-- Fixes:
--   (A1) ai_settings secrets (api keys, OpenRouter OAuth token and PKCE
--        verifier) were readable by any org member through the user client.
--        SELECT is now granted per column, excluding the seven secrets.
--   (M3) Users could rewrite their own token usage counters and limits.
--        UPDATE is now granted per column, excluding usage/limit columns.
--        Secret columns stay writable (write-only): the OpenRouter OAuth
--        routes (app/api/lead-finder/auth/openrouter/*) write the verifier
--        and token with the user client.
--   (INSERT) Same column set for INSERT (plus organization_id), so a new
--        row cannot be seeded with forged usage/limit values.
--   (A3) campaign_leads / automation_executions WITH CHECK did not verify
--        lead_id, so a user could attach another organization's lead.
--   (A5) SECURITY DEFINER counter RPCs were executable by anon and
--        authenticated and had no pinned search_path. Now service_role only.
--   (A6) Sole members of an organization are backfilled to 'admin'.
--
-- Safe to re-run: every statement is idempotent (REVOKE/GRANT, DROP ... IF
-- EXISTS + CREATE, ALTER FUNCTION ... SET, guarded UPDATE).
-- Apply by hand in the Supabase SQL editor (paste the whole file, Run).
-- App code is safe before and after applying.
-- ============================================================


-- ─── (A1) ai_settings: column-level SELECT without secrets ──────────────────
--
-- A column-level REVOKE alone is a no-op while the table-level grant exists,
-- so the table-level privilege is revoked first and the allowed columns are
-- granted back explicitly. Excluded (secrets): api_key, openai_api_key,
-- openrouter_api_key, groq_api_key, apify_api_key, openrouter_oauth_token,
-- openrouter_code_verifier. Server code that needs them uses the admin
-- client (service_role keeps its table-level grants).

REVOKE SELECT ON public.ai_settings FROM anon, authenticated;
GRANT SELECT (
  id, organization_id, ai_provider, openrouter_expires_at, ollama_base_url,
  obsidian_vault_path, obsidian_sync_enabled, default_model,
  feature_lead_scoring, feature_icp_matching, feature_outreach,
  feature_proposals, feature_meetings, feature_analytics,
  feature_competitors, feature_objections, feature_chat, feature_marketing,
  autonomy_lead_scoring, autonomy_icp_matching, autonomy_outreach,
  autonomy_proposals, autonomy_meetings, autonomy_analytics,
  autonomy_competitors, autonomy_objections,
  tokens_used_today, tokens_used_month, daily_token_limit,
  monthly_token_limit, last_token_reset_daily, last_token_reset_monthly,
  parallel_enrichment_limit, created_at, updated_at
) ON public.ai_settings TO authenticated;


-- ─── (M3) ai_settings: column-level UPDATE without usage/limit columns ──────
--
-- Excluded: id, organization_id, created_at, tokens_used_today,
-- tokens_used_month, last_token_reset_daily, last_token_reset_monthly,
-- daily_token_limit, monthly_token_limit. Token accounting must go through
-- the admin client. openrouter_expires_at is writable because the OpenRouter
-- OAuth callback sets it alongside the token with the user client.

REVOKE UPDATE ON public.ai_settings FROM anon, authenticated;
GRANT UPDATE (
  ai_provider, default_model, ollama_base_url, obsidian_vault_path,
  obsidian_sync_enabled, parallel_enrichment_limit, openrouter_expires_at,
  feature_lead_scoring, feature_icp_matching, feature_outreach,
  feature_proposals, feature_meetings, feature_analytics,
  feature_competitors, feature_objections, feature_chat, feature_marketing,
  autonomy_lead_scoring, autonomy_icp_matching, autonomy_outreach,
  autonomy_proposals, autonomy_meetings, autonomy_analytics,
  autonomy_competitors, autonomy_objections,
  updated_at,
  api_key, openai_api_key, openrouter_api_key, groq_api_key, apify_api_key,
  openrouter_oauth_token, openrouter_code_verifier
) ON public.ai_settings TO authenticated;


-- ─── (INSERT) ai_settings: same writable columns plus organization_id ───────
--
-- User-client inserts: app/api/lead-finder/settings/route.ts and
-- app/api/lead-finder/auth/openrouter/route.ts; none supplies a usage or
-- limit column, so those fall back to their defaults.

REVOKE INSERT ON public.ai_settings FROM anon, authenticated;
GRANT INSERT (
  organization_id,
  ai_provider, default_model, ollama_base_url, obsidian_vault_path,
  obsidian_sync_enabled, parallel_enrichment_limit, openrouter_expires_at,
  feature_lead_scoring, feature_icp_matching, feature_outreach,
  feature_proposals, feature_meetings, feature_analytics,
  feature_competitors, feature_objections, feature_chat, feature_marketing,
  autonomy_lead_scoring, autonomy_icp_matching, autonomy_outreach,
  autonomy_proposals, autonomy_meetings, autonomy_analytics,
  autonomy_competitors, autonomy_objections,
  updated_at,
  api_key, openai_api_key, openrouter_api_key, groq_api_key, apify_api_key,
  openrouter_oauth_token, openrouter_code_verifier
) ON public.ai_settings TO authenticated;


-- ─── (A3) campaign_leads / automation_executions: lead must be in the org ───
-- USING / WITH CHECK copied from 028; WITH CHECK additionally requires a
-- non-null lead_id to belong to the user's organization.

DROP POLICY IF EXISTS campaign_leads_org_isolation ON campaign_leads;
CREATE POLICY campaign_leads_org_isolation ON campaign_leads
  FOR ALL
  USING (
    campaign_id IN (
      SELECT id FROM campaign_runs WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaign_runs WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND (lead_id IS NULL OR lead_id IN (SELECT id FROM leads WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())))
  );

DROP POLICY IF EXISTS automation_executions_org_isolation ON automation_executions;
CREATE POLICY automation_executions_org_isolation ON automation_executions
  FOR ALL
  USING (
    rule_id IN (
      SELECT id FROM automation_rules WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    rule_id IN (
      SELECT id FROM automation_rules WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND (lead_id IS NULL OR lead_id IN (SELECT id FROM leads WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())))
  );


-- ─── (A5) SECURITY DEFINER counter RPCs: service_role only ──────────────────
-- Functions are executable by PUBLIC by default, so PUBLIC is revoked too.
-- Only app caller: increment_automation_rule_count via the admin client.

ALTER FUNCTION public.increment_daily_sent_count(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.increment_daily_sent_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_daily_sent_count(uuid) TO service_role;

ALTER FUNCTION public.increment_message_open_count(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.increment_message_open_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_message_open_count(uuid) TO service_role;

ALTER FUNCTION public.increment_message_click_count(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.increment_message_click_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_message_click_count(uuid) TO service_role;

ALTER FUNCTION public.increment_link_click_count(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.increment_link_click_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_click_count(uuid) TO service_role;

ALTER FUNCTION public.reset_daily_sent_counts() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.reset_daily_sent_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_daily_sent_counts() TO service_role;

ALTER FUNCTION public.increment_automation_rule_count(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.increment_automation_rule_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_automation_rule_count(uuid) TO service_role;


-- ─── (A6) Sole-member organizations: promote the only member to admin ───────
-- Runs from the SQL editor (auth.role() is NULL), so 028's
-- protect_profile_tenant_columns trigger allows the role change.
-- Never promotes anyone in a multi-member organization.

UPDATE public.profiles p
SET role = 'admin'
WHERE p.organization_id IS NOT NULL
  AND p.role IS DISTINCT FROM 'owner'
  AND p.role IS DISTINCT FROM 'admin'
  AND (SELECT count(*) FROM public.profiles q WHERE q.organization_id = p.organization_id) = 1;

-- Multi-member organizations with no admin/owner are left for the owner to
-- resolve by hand (comments only -- not executed):
--
--   SELECT organization_id FROM profiles
--   WHERE organization_id IS NOT NULL
--   GROUP BY 1
--   HAVING count(*) > 1 AND bool_and(role NOT IN ('admin','owner'));
--
-- Then, for each, pick the right member and run:
--   UPDATE profiles SET role = 'admin' WHERE id = '<profile id>';
