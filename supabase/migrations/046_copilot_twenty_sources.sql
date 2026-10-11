-- Apply after 045; production application requires reviewed cutover approval.
BEGIN;

ALTER TABLE public.copilot_conversations
  ADD COLUMN IF NOT EXISTS crm_source text NOT NULL DEFAULT 'pulse' CHECK (crm_source IN ('pulse','twenty')),
  ADD COLUMN IF NOT EXISTS integration_connection_id uuid;
ALTER TABLE public.copilot_conversations ADD CONSTRAINT copilot_conversations_connection_fk
  FOREIGN KEY (integration_connection_id,organization_id) REFERENCES public.twenty_connections(id,organization_id);
ALTER TABLE public.copilot_conversations ADD CONSTRAINT copilot_conversations_source_binding
  CHECK ((crm_source='pulse' AND integration_connection_id IS NULL) OR (crm_source='twenty' AND integration_connection_id IS NOT NULL));

ALTER TABLE public.copilot_approvals
  ADD COLUMN IF NOT EXISTS crm_source text NOT NULL DEFAULT 'pulse' CHECK (crm_source IN ('pulse','twenty')),
  ADD COLUMN IF NOT EXISTS connection_id uuid,
  ADD COLUMN IF NOT EXISTS connection_revision integer;
ALTER TABLE public.copilot_approvals DROP CONSTRAINT IF EXISTS copilot_approvals_source_check;
ALTER TABLE public.copilot_approvals ADD CONSTRAINT copilot_approvals_source_check CHECK (source IN ('chat','task','workflow'));
ALTER TABLE public.copilot_approvals DROP CONSTRAINT IF EXISTS copilot_approvals_status_check;
ALTER TABLE public.copilot_approvals ADD CONSTRAINT copilot_approvals_status_check
  CHECK (status IN ('pending','approved','denied','applied','failed','stale','expired','partial','unknown_outcome'));
ALTER TABLE public.copilot_approvals ADD CONSTRAINT copilot_approvals_connection_fk
  FOREIGN KEY (connection_id,organization_id) REFERENCES public.twenty_connections(id,organization_id);
ALTER TABLE public.copilot_approvals ADD CONSTRAINT copilot_approvals_source_binding
  CHECK ((crm_source='pulse' AND connection_id IS NULL AND connection_revision IS NULL) OR
         (crm_source='twenty' AND connection_id IS NOT NULL AND connection_revision IS NOT NULL));

ALTER TABLE public.copilot_artifacts
  ADD COLUMN IF NOT EXISTS crm_source text NOT NULL DEFAULT 'pulse' CHECK (crm_source IN ('pulse','twenty')),
  ADD COLUMN IF NOT EXISTS connection_id uuid,
  ADD COLUMN IF NOT EXISTS external_record_ref jsonb;
ALTER TABLE public.copilot_memory
  ADD COLUMN IF NOT EXISTS crm_source text NOT NULL DEFAULT 'pulse' CHECK (crm_source IN ('pulse','twenty')),
  ADD COLUMN IF NOT EXISTS connection_id uuid;
ALTER TABLE public.copilot_artifacts ADD CONSTRAINT copilot_artifacts_connection_fk
  FOREIGN KEY (connection_id,organization_id) REFERENCES public.twenty_connections(id,organization_id);
ALTER TABLE public.copilot_memory ADD CONSTRAINT copilot_memory_connection_fk
  FOREIGN KEY (connection_id,organization_id) REFERENCES public.twenty_connections(id,organization_id);
ALTER TABLE public.copilot_artifacts ADD CONSTRAINT copilot_artifacts_source_binding
  CHECK ((crm_source='pulse' AND connection_id IS NULL AND external_record_ref IS NULL) OR
         (crm_source='twenty' AND connection_id IS NOT NULL AND linked_record_id IS NULL AND linked_record_type IS NULL));
ALTER TABLE public.copilot_memory ADD CONSTRAINT copilot_memory_source_binding
  CHECK ((crm_source='pulse' AND connection_id IS NULL) OR (crm_source='twenty' AND connection_id IS NOT NULL));

CREATE OR REPLACE FUNCTION public.copilot_twenty_pilot_access(org uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT COALESCE((auth.jwt()->>'is_anonymous')::boolean,false) = false
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND organization_id=org AND role IN ('owner','admin') AND email NOT LIKE '%@guest.local');
$$;

-- Restrictive policies add the pilot boundary to the existing ownership/org policies.
CREATE POLICY copilot_conversations_twenty_pilot ON public.copilot_conversations AS RESTRICTIVE FOR ALL TO authenticated
  USING (crm_source='pulse' OR public.copilot_twenty_pilot_access(organization_id))
  WITH CHECK (crm_source='pulse' OR public.copilot_twenty_pilot_access(organization_id));
CREATE POLICY copilot_approvals_twenty_pilot ON public.copilot_approvals AS RESTRICTIVE FOR SELECT TO authenticated
  USING (crm_source='pulse' OR public.copilot_twenty_pilot_access(organization_id));
CREATE POLICY copilot_artifacts_twenty_pilot ON public.copilot_artifacts AS RESTRICTIVE FOR ALL TO authenticated
  USING (crm_source='pulse' OR public.copilot_twenty_pilot_access(organization_id))
  WITH CHECK (crm_source='pulse' OR public.copilot_twenty_pilot_access(organization_id));
CREATE POLICY copilot_memory_twenty_pilot ON public.copilot_memory AS RESTRICTIVE FOR ALL TO authenticated
  USING (crm_source='pulse' OR public.copilot_twenty_pilot_access(organization_id))
  WITH CHECK (crm_source='pulse' OR public.copilot_twenty_pilot_access(organization_id));

CREATE OR REPLACE FUNCTION public.copilot_immutable_crm_source() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.crm_source IS DISTINCT FROM NEW.crm_source OR
     (to_jsonb(OLD)->'integration_connection_id') IS DISTINCT FROM (to_jsonb(NEW)->'integration_connection_id') OR
     (to_jsonb(OLD)->'connection_id') IS DISTINCT FROM (to_jsonb(NEW)->'connection_id') THEN
    RAISE EXCEPTION 'crm_source_is_immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER copilot_conversations_immutable_source BEFORE UPDATE ON public.copilot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.copilot_immutable_crm_source();
CREATE TRIGGER copilot_artifacts_immutable_source BEFORE UPDATE ON public.copilot_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.copilot_immutable_crm_source();
CREATE TRIGGER copilot_memory_immutable_source BEFORE UPDATE ON public.copilot_memory
  FOR EACH ROW EXECUTE FUNCTION public.copilot_immutable_crm_source();

CREATE INDEX copilot_memory_source_idx ON public.copilot_memory(organization_id,crm_source,connection_id);
CREATE INDEX copilot_artifacts_source_idx ON public.copilot_artifacts(organization_id,crm_source,connection_id,created_at DESC);

-- Cross-approval creation fences. Unknown results never expire or become retryable.
CREATE TABLE public.twenty_creation_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  connection_id uuid NOT NULL,
  reservation_key text NOT NULL CHECK (reservation_key ~ '^(email|domain):[^[:space:]]+$'),
  approval_id uuid NOT NULL REFERENCES public.copilot_approvals(id),
  approval_hash text NOT NULL CHECK (approval_hash ~ '^[a-f0-9]{64}$'),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','unknown_outcome','released')),
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (connection_id,organization_id) REFERENCES public.twenty_connections(id,organization_id),
  UNIQUE (organization_id,connection_id,reservation_key)
);
CREATE TABLE public.twenty_creation_reservation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  connection_id uuid NOT NULL,
  reservation_id uuid NOT NULL REFERENCES public.twenty_creation_reservations(id),
  approval_id uuid NOT NULL REFERENCES public.copilot_approvals(id),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  event text NOT NULL CHECK (event IN ('claimed','completed','unknown_outcome','released')),
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (connection_id,organization_id) REFERENCES public.twenty_connections(id,organization_id)
);
ALTER TABLE public.twenty_creation_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twenty_creation_reservation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.twenty_creation_reservations,public.twenty_creation_reservation_events FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.twenty_claim_creation_reservations(
  p_org uuid,p_connection uuid,p_user uuid,p_hash text,p_keys text[]
) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE approval public.copilot_approvals; expected text[] := ARRAY[]::text[]; sorted text[];
  key text; claimed uuid; ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT a.* INTO approval FROM public.copilot_approvals a JOIN public.twenty_connections c
    ON c.id=a.connection_id AND c.organization_id=a.organization_id
    JOIN public.profiles p ON p.id=a.user_id AND p.organization_id=a.organization_id
    JOIN auth.users u ON u.id=p.id
    WHERE a.organization_id=p_org AND a.connection_id=p_connection AND a.user_id=p_user
      AND a.crm_source='twenty' AND a.status='approved' AND a.source IN ('chat','task','workflow')
      AND p.role IN ('owner','admin') AND p.email NOT LIKE '%@guest.local' AND COALESCE(u.is_anonymous,false)=false
      AND ((a.source='chat' AND a.conversation_id IS NOT NULL AND a.task_id IS NULL)
        OR (a.source='task' AND a.task_id IS NOT NULL AND a.conversation_id IS NULL)
        OR (a.source='workflow' AND a.conversation_id IS NULL AND a.task_id IS NULL AND NULLIF(to_jsonb(a)->>'workflow_job_id','') IS NOT NULL))
      AND a.tool_name IN ('twenty_quick_lead','twenty_link_company')
      AND a.diff#>>'{approvalBinding,payloadHash}'=p_hash
      AND a.diff#>>'{approvalBinding,userId}'=p_user::text
      AND a.diff#>>'{approvalBinding,connectionId}'=p_connection::text
      AND a.diff#>>'{approvalBinding,crmSource}'='twenty'
      AND a.diff#>>'{approvalBinding,connectionRevision}'=c.revision::text
      AND a.connection_revision=c.revision AND c.status='verified'
    ORDER BY a.resolved_at DESC LIMIT 1 FOR UPDATE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_creation_approval'; END IF;
  IF approval.tool_name='twenty_quick_lead' THEN
    IF NULLIF(approval.input->>'email','') IS NULL THEN RAISE EXCEPTION 'invalid_creation_email'; END IF;
    expected := array_append(expected,'email:' || lower(approval.input->>'email'));
  END IF;
  IF NULLIF(approval.input->>'companyDomain','') IS NOT NULL
     AND NULLIF(approval.diff#>>'{approvalBinding,preconditions,companyId}','') IS NULL THEN
    expected := array_append(expected,'domain:' || lower(approval.input->>'companyDomain'));
  END IF;
  SELECT array_agg(k ORDER BY k) INTO expected FROM unnest(expected) k;
  SELECT array_agg(k ORDER BY k) INTO sorted FROM unnest(p_keys) k;
  IF sorted IS DISTINCT FROM expected OR cardinality(p_keys) NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'invalid_creation_keys'; END IF;
  FOREACH key IN ARRAY sorted LOOP
    claimed := NULL;
    INSERT INTO public.twenty_creation_reservations(organization_id,connection_id,reservation_key,approval_id,approval_hash,owner_id)
      VALUES(p_org,p_connection,key,approval.id,p_hash,p_user)
      ON CONFLICT(organization_id,connection_id,reservation_key) DO UPDATE
      SET approval_id=EXCLUDED.approval_id,approval_hash=EXCLUDED.approval_hash,owner_id=EXCLUDED.owner_id,status='running',external_ids='{}',updated_at=now()
      WHERE twenty_creation_reservations.status='released'
      RETURNING id INTO claimed;
    IF claimed IS NULL THEN RAISE EXCEPTION 'creation_key_busy'; END IF;
    ids := array_append(ids,claimed);
    INSERT INTO public.twenty_creation_reservation_events(organization_id,connection_id,reservation_id,approval_id,owner_id,event)
      VALUES(p_org,p_connection,claimed,approval.id,p_user,'claimed');
  END LOOP;
  RETURN ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.twenty_finish_creation_reservations(
  p_org uuid,p_connection uuid,p_user uuid,p_hash text,p_ids uuid[],p_state text,p_external_ids jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE reservation public.twenty_creation_reservations; next_status text; matched integer := 0;
BEGIN
  IF p_state NOT IN ('success','known_failure','unknown_outcome') OR cardinality(p_ids) NOT BETWEEN 1 AND 2
     OR jsonb_typeof(p_external_ids)<>'object' THEN RAISE EXCEPTION 'invalid_creation_outcome'; END IF;
  FOR reservation IN SELECT * FROM public.twenty_creation_reservations
    WHERE organization_id=p_org AND connection_id=p_connection AND owner_id=p_user AND approval_hash=p_hash
      AND id=ANY(p_ids) AND status='running' ORDER BY reservation_key FOR UPDATE
  LOOP
    matched := matched+1;
    IF (reservation.reservation_key LIKE 'email:%' AND NULLIF(p_external_ids->>'personId','') IS NOT NULL)
       OR (reservation.reservation_key LIKE 'domain:%' AND NULLIF(p_external_ids->>'companyId','') IS NOT NULL) THEN
      next_status := 'completed';
    ELSIF p_state='unknown_outcome' THEN next_status := 'unknown_outcome';
    ELSE next_status := 'released'; END IF;
    UPDATE public.twenty_creation_reservations SET status=next_status,external_ids=p_external_ids,updated_at=now() WHERE id=reservation.id;
    INSERT INTO public.twenty_creation_reservation_events(organization_id,connection_id,reservation_id,approval_id,owner_id,event,external_ids)
      VALUES(p_org,p_connection,reservation.id,reservation.approval_id,p_user,next_status,p_external_ids);
  END LOOP;
  IF matched<>cardinality(p_ids) THEN RAISE EXCEPTION 'creation_reservation_changed'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.twenty_claim_creation_reservations(uuid,uuid,uuid,text,text[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.twenty_finish_creation_reservations(uuid,uuid,uuid,text,uuid[],text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.twenty_claim_creation_reservations(uuid,uuid,uuid,text,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.twenty_finish_creation_reservations(uuid,uuid,uuid,text,uuid[],text,jsonb) TO service_role;
COMMIT;
