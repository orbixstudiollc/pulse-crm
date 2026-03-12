-- ============================================================
-- Fix RLS INSERT policy on organizations table
--
-- Problem: The original policy uses auth.role() = 'authenticated'
-- which is unreliable in some Supabase configurations. The
-- auth.role() function returns the PostgreSQL role from the JWT,
-- but can fail to match when the JWT role claim doesn't exactly
-- equal 'authenticated'.
--
-- Fix: Replace with auth.uid() IS NOT NULL, which is the
-- standard and reliable way to verify a user is authenticated.
-- ============================================================

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON organizations;

-- Create a corrected INSERT policy using auth.uid()
CREATE POLICY "Authenticated users can create orgs"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
