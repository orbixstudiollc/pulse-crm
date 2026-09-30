-- ============================================================
-- 031 Account tables: role-predicate RLS
--
-- Fixes:
--   email_accounts ("org_email_accounts", 016), whatsapp_accounts
--   ("whatsapp_accounts_org_scope") and linkedin_accounts
--   ("linkedin_accounts_org_scope", 20260313_multichannel) each had one
--   FOR ALL policy keyed on org membership only. The requireRole('admin',
--   'owner') gates in the server actions therefore did not hold for direct
--   PostgREST calls: any org member could insert or delete accounts.
--   Each FOR ALL policy is replaced by per-command policies:
--
--     member = organization_id IN (SELECT organization_id FROM profiles
--                                  WHERE id = auth.uid())
--     admin  = EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
--                      AND role is admin or owner)
--
--   Table              SELECT   INSERT            UPDATE   DELETE
--   email_accounts     member   member AND admin  member   member AND admin
--   whatsapp_accounts  member   member            member   member AND admin
--   linkedin_accounts  member   member            member   member AND admin
--
--   Mapping to code:
--     email_accounts INSERT  -> addCustomEmailAccount (lib/actions/
--       email-accounts.ts), createEmailAccount (lib/actions/campaigns.ts),
--       and the Google / Microsoft OAuth callbacks (now admin-gated).
--     email_accounts DELETE  -> deleteEmailAccount (email-accounts.ts and
--       campaigns.ts).
--     whatsapp_accounts / linkedin_accounts DELETE -> disconnect* / delete*
--       in lib/actions/whatsapp-accounts.ts and linkedin-accounts.ts.
--     whatsapp_accounts / linkedin_accounts INSERT stay member-only because
--       connectWhatsAppAccount and saveLinkedInAccount are not role-gated.
--     UPDATE stays member-only on all three tables.
--
--   Service-role writers (cron routes, lib/email/sender.ts,
--   lib/whatsapp/sender.ts, lib/linkedin/*) bypass RLS and are unaffected.
--   Open-access guests are admins of their own workspace
--   (lib/auth/guest-workspace.ts; 030 backfills sole members), so guest
--   flows are unaffected.
--
-- Safe to re-run: every CREATE POLICY is preceded by DROP POLICY IF EXISTS.
-- Apply by hand in the Supabase SQL editor (paste the whole file, Run).
-- App code is safe before and after applying.
-- ============================================================


-- ─── email_accounts ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "org_email_accounts" ON public.email_accounts;

DROP POLICY IF EXISTS "email_accounts_select" ON public.email_accounts;
CREATE POLICY "email_accounts_select" ON public.email_accounts
  FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "email_accounts_insert" ON public.email_accounts;
CREATE POLICY "email_accounts_insert" ON public.email_accounts
  FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
  );

DROP POLICY IF EXISTS "email_accounts_update" ON public.email_accounts;
CREATE POLICY "email_accounts_update" ON public.email_accounts
  FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "email_accounts_delete" ON public.email_accounts;
CREATE POLICY "email_accounts_delete" ON public.email_accounts
  FOR DELETE
  USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
  );


-- ─── whatsapp_accounts ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "whatsapp_accounts_org_scope" ON public.whatsapp_accounts;

DROP POLICY IF EXISTS "whatsapp_accounts_select" ON public.whatsapp_accounts;
CREATE POLICY "whatsapp_accounts_select" ON public.whatsapp_accounts
  FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "whatsapp_accounts_insert" ON public.whatsapp_accounts;
CREATE POLICY "whatsapp_accounts_insert" ON public.whatsapp_accounts
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "whatsapp_accounts_update" ON public.whatsapp_accounts;
CREATE POLICY "whatsapp_accounts_update" ON public.whatsapp_accounts
  FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "whatsapp_accounts_delete" ON public.whatsapp_accounts;
CREATE POLICY "whatsapp_accounts_delete" ON public.whatsapp_accounts
  FOR DELETE
  USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
  );


-- ─── linkedin_accounts ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "linkedin_accounts_org_scope" ON public.linkedin_accounts;

DROP POLICY IF EXISTS "linkedin_accounts_select" ON public.linkedin_accounts;
CREATE POLICY "linkedin_accounts_select" ON public.linkedin_accounts
  FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "linkedin_accounts_insert" ON public.linkedin_accounts;
CREATE POLICY "linkedin_accounts_insert" ON public.linkedin_accounts
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "linkedin_accounts_update" ON public.linkedin_accounts;
CREATE POLICY "linkedin_accounts_update" ON public.linkedin_accounts
  FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "linkedin_accounts_delete" ON public.linkedin_accounts;
CREATE POLICY "linkedin_accounts_delete" ON public.linkedin_accounts
  FOR DELETE
  USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
  );


-- ─── Verification (comments only -- not executed) ──────────────────────────
--
-- Expect exactly four policies per table (select/insert/update/delete):
--
--   SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('email_accounts', 'whatsapp_accounts', 'linkedin_accounts')
--   ORDER BY tablename, policyname;
--
-- Expect zero rows (no FOR ALL policy left on these tables):
--
--   SELECT tablename, policyname
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('email_accounts', 'whatsapp_accounts', 'linkedin_accounts')
--     AND cmd = 'ALL';
