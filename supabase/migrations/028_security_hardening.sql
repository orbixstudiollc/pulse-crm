-- ============================================================
-- 028 Security hardening
--
-- Fixes:
--   (C1) Users could change their own profiles.organization_id / role
--        (the UPDATE policy had no WITH CHECK and no column guard), which
--        allowed hopping into another tenant or self-promoting to admin.
--        Adds a fail-closed BEFORE UPDATE trigger plus WITH CHECK.
--   (H3) automation_executions and campaign_leads had no RLS, so any
--        authenticated user could read/write rows of every organization.
--   (H5) sequence_enrollments only checked the sequence's org, so a user
--        could enroll a lead belonging to another organization.
--
-- Safe to re-run: every object uses CREATE OR REPLACE / DROP ... IF EXISTS.
-- Apply by hand in the Supabase SQL editor (paste the whole file, Run).
-- ============================================================


-- ─── (C1) Profiles: lock organization_id and role ────────────────────────────
--
-- Gate: any JWT-bearing request whose role is not service_role is blocked
-- from changing organization_id or role. That covers authenticated, anon,
-- and any unexpected role claim (see 002's note on the JWT role claim not
-- always matching the expected value) -- the check fails closed rather than
-- trying to enumerate the "bad" roles.
-- SECURITY DEFINER RPCs do not change auth.role() (it reads the request's
-- JWT claims), so a user calling such an RPC is blocked too.
-- A NULL auth.role() means no JWT at all (SQL editor, Dashboard table editor,
-- migrations); that is allowed so the owner can still administer roles.
-- Onboarding is unaffected: completeOnboarding (lib/actions/auth.ts) writes
-- organization_id through createAdminClient, i.e. as service_role.

CREATE OR REPLACE FUNCTION public.protect_profile_tenant_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.role IS DISTINCT FROM OLD.role)
     AND auth.role() IS NOT NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'organization_id and role cannot be changed by the user'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_profile_tenant_columns ON profiles;
CREATE TRIGGER protect_profile_tenant_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_tenant_columns();

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ─── (H3) automation_executions: org isolation via automation_rules ─────────
-- Writers (cron executor, lib/actions/automation.ts) use the admin client.

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

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
  );

DROP POLICY IF EXISTS "Service role full access to automation_executions" ON automation_executions;
CREATE POLICY "Service role full access to automation_executions" ON automation_executions
  FOR ALL USING (auth.role() = 'service_role');


-- ─── (H3) campaign_leads: org isolation via campaign_runs ───────────────────
-- lib/actions/campaigns.ts inserts with the user client for a campaign_run
-- the user's org owns, so WITH CHECK passes.

ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

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
  );

DROP POLICY IF EXISTS "Service role full access to campaign_leads" ON campaign_leads;
CREATE POLICY "Service role full access to campaign_leads" ON campaign_leads
  FOR ALL USING (auth.role() = 'service_role');


-- ─── (H5) sequence_enrollments: lead must belong to the user's org too ──────

DROP POLICY IF EXISTS "sequence_enrollments_via_sequence" ON sequence_enrollments;
CREATE POLICY "sequence_enrollments_via_sequence" ON sequence_enrollments
  FOR ALL
  USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    sequence_id IN (
      SELECT id FROM sequences WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND lead_id IN (SELECT id FROM leads WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Service role full access to sequence_enrollments" ON sequence_enrollments;
CREATE POLICY "Service role full access to sequence_enrollments" ON sequence_enrollments
  FOR ALL USING (auth.role() = 'service_role');


-- ============================================================
-- Owner verification (comments only -- not executed):
--
--   1. In the SQL editor, before applying:
--        select auth.role();
--      must return NULL (so the trigger lets the owner administer roles).
--   2. After applying, sign up a fresh user and confirm onboarding
--      completes (organization_id is set via the service-role client).
--   3. Optional: as a signed-in user, an UPDATE of your own profile's
--      role or organization_id must fail with error 42501.
-- ============================================================
