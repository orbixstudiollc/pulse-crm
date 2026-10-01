-- ============================================================
-- 036 api_keys: per-workspace keys for the MCP server (/api/mcp)
--
-- An AI client (Claude, Codex, any MCP client) sends
-- "Authorization: Bearer pcrm_..." and gets access to that key's workspace
-- only. The plaintext key is shown once on creation and never stored; the
-- table keeps its SHA-256 hash (the key is 32 random bytes, so a fast hash
-- is enough) and a short prefix so people can tell keys apart.
--
-- scope: 'read' keys can only call read tools, 'write' keys can also create,
-- update and delete records.
--
-- Access: workspace admins/owners can SELECT their org's keys. There are no
-- INSERT/UPDATE/DELETE policies: keys are created and revoked by admin-gated
-- server actions (lib/actions/api-keys.ts) and looked up by the MCP route,
-- both through the service role.
--
-- Safe to re-run. Apply by hand in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'read' CHECK (scope IN ('read', 'write')),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON public.api_keys(organization_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_select_admin" ON public.api_keys;
CREATE POLICY "api_keys_select_admin" ON public.api_keys
  FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
