-- Twenty connection metadata is owner/admin-readable. Credentials and configuration
-- writes are service-role-only. Apply after reviewing the production cutover checklist.
BEGIN;

CREATE TABLE IF NOT EXISTS public.twenty_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  workspace_url text NOT NULL CHECK (workspace_url ~ '^https://[a-z0-9-]+\.twenty\.com$'),
  workspace_id uuid NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified','revoked')),
  cas_verified boolean NOT NULL DEFAULT false,
  writes_enabled boolean NOT NULL DEFAULT false,
  cutover_audit jsonb,
  monthly_token_cap bigint CHECK (monthly_token_cap IS NULL OR monthly_token_cap BETWEEN 1 AND 1000000000),
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id),
  UNIQUE (id, organization_id),
  CHECK (NOT writes_enabled OR (cas_verified AND cutover_audit IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.twenty_connection_credentials (
  connection_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  api_key_ciphertext text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (connection_id, organization_id) REFERENCES public.twenty_connections(id, organization_id) ON DELETE CASCADE
);
ALTER TABLE public.twenty_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twenty_connection_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.twenty_connection_credentials FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.twenty_connections FROM anon, authenticated;
DROP POLICY IF EXISTS twenty_connections_select ON public.twenty_connections;
CREATE POLICY twenty_connections_select ON public.twenty_connections FOR SELECT TO authenticated USING (
  organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','owner') AND p.email NOT LIKE '%@guest.local')
  AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = false
);

-- Configuration replacement and secret replacement form one transaction. The
-- expected revision prevents concurrent saves from silently replacing each other.
CREATE OR REPLACE FUNCTION public.twenty_connection_identity_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.workspace_url IS DISTINCT FROM OLD.workspace_url OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'twenty_workspace_identity_is_immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER twenty_connection_identity_immutable BEFORE UPDATE ON public.twenty_connections
FOR EACH ROW EXECUTE FUNCTION public.twenty_connection_identity_immutable();

CREATE OR REPLACE FUNCTION public.save_twenty_connection(
  p_id uuid, p_org_id uuid, p_owner_id uuid, p_url text, p_workspace_id uuid,
  p_ciphertext text, p_cas_verified boolean, p_expected_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE existing public.twenty_connections; saved public.twenty_connections;
BEGIN
  PERFORM 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_owner_id AND p.organization_id=p_org_id AND p.role IN ('admin','owner') AND p.email NOT LIKE '%@guest.local' AND COALESCE(u.is_anonymous,false)=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owner or admin access required'; END IF;
  SELECT * INTO existing FROM public.twenty_connections WHERE organization_id=p_org_id FOR UPDATE;
  IF FOUND THEN
    IF existing.id<>p_id OR existing.revision<>p_expected_revision THEN RAISE EXCEPTION 'Connection changed; refresh and try again'; END IF;
    UPDATE public.twenty_connections SET owner_id=p_owner_id,workspace_url=p_url,workspace_id=p_workspace_id,
      revision=revision+1,status='verified',cas_verified=p_cas_verified,writes_enabled=false,cutover_audit=NULL,
      monthly_token_cap=NULL,verified_at=now(),updated_at=now() WHERE id=p_id RETURNING * INTO saved;
  ELSE
    IF p_expected_revision<>0 THEN RAISE EXCEPTION 'Connection changed; refresh and try again'; END IF;
    INSERT INTO public.twenty_connections(id,organization_id,owner_id,workspace_url,workspace_id,cas_verified)
      VALUES(p_id,p_org_id,p_owner_id,p_url,p_workspace_id,p_cas_verified) RETURNING * INTO saved;
  END IF;
  INSERT INTO public.twenty_connection_credentials(connection_id,organization_id,api_key_ciphertext)
    VALUES(p_id,p_org_id,p_ciphertext) ON CONFLICT(connection_id) DO UPDATE SET api_key_ciphertext=EXCLUDED.api_key_ciphertext,updated_at=now();
  RETURN to_jsonb(saved);
END;
$$;
REVOKE ALL ON FUNCTION public.save_twenty_connection(uuid,uuid,uuid,text,uuid,text,boolean,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_twenty_connection(uuid,uuid,uuid,text,uuid,text,boolean,integer) TO service_role;

COMMIT;
