-- Durable external sales workflows. All changes to these tables use server-only,
-- explicitly tenant-scoped service-role calls. Ordinary users have no write grants.
BEGIN;
CREATE TABLE public.twenty_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  connection_revision integer NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK (kind IN ('company_link','mailbox_ready','qualification')),
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}', checkpoint jsonb NOT NULL DEFAULT '{}',
  lease_token uuid, lease_until timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id,kind), UNIQUE(id,organization_id),
  FOREIGN KEY(connection_id,organization_id) REFERENCES public.twenty_connections(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE public.twenty_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  connection_revision integer NOT NULL,
  workflow_id uuid,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK (kind IN ('company_link','mailbox_ready','qualification','quick_lead')),
  record_id uuid, record_version timestamptz, payload jsonb NOT NULL,
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','awaiting_approval','applied','denied','stale','failed','unknown_outcome','partial','skipped')),
  attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid, lease_until timestamptz,
  approval_id uuid REFERENCES public.copilot_approvals(id), result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,dedupe_key), UNIQUE(id,organization_id),
  FOREIGN KEY(connection_id,organization_id) REFERENCES public.twenty_connections(id,organization_id) ON DELETE CASCADE,
  FOREIGN KEY(workflow_id,organization_id) REFERENCES public.twenty_workflows(id,organization_id) ON DELETE CASCADE
);
CREATE INDEX twenty_jobs_ready ON public.twenty_jobs(next_attempt_at) WHERE status IN ('queued','running');
CREATE TABLE public.twenty_workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid, job_id uuid,
  event text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workflow_id,organization_id) REFERENCES public.twenty_workflows(id,organization_id) ON DELETE CASCADE,
  FOREIGN KEY(job_id,organization_id) REFERENCES public.twenty_jobs(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE public.twenty_mailbox_states (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL,
  record_id uuid NOT NULL, ready boolean NOT NULL, record_version timestamptz NOT NULL,
  PRIMARY KEY(workflow_id,record_id),
  FOREIGN KEY(workflow_id,organization_id) REFERENCES public.twenty_workflows(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE public.twenty_token_usage (
  connection_id uuid NOT NULL REFERENCES public.twenty_connections(id) ON DELETE CASCADE,
  month date NOT NULL, used bigint NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY(connection_id,month)
);
CREATE TABLE public.twenty_token_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), connection_id uuid NOT NULL REFERENCES public.twenty_connections(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.twenty_jobs(id) ON DELETE CASCADE, month date NOT NULL,
  reserved integer NOT NULL CHECK (reserved > 0), settled boolean NOT NULL DEFAULT false,
  UNIQUE(job_id)
);
ALTER TABLE public.copilot_approvals ADD COLUMN workflow_job_id uuid;
ALTER TABLE public.copilot_approvals ADD CONSTRAINT twenty_workflow_approval_job_fk
  FOREIGN KEY(workflow_job_id,organization_id) REFERENCES public.twenty_jobs(id,organization_id);
ALTER TABLE public.copilot_approvals ADD CONSTRAINT twenty_workflow_approval_job CHECK (
  (source='workflow' AND crm_source='twenty' AND workflow_job_id IS NOT NULL AND conversation_id IS NULL AND task_id IS NULL)
  OR (source<>'workflow' AND workflow_job_id IS NULL)
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['twenty_workflows','twenty_jobs','twenty_workflow_runs','twenty_mailbox_states','twenty_token_usage','twenty_token_reservations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;

CREATE FUNCTION public.claim_twenty_workflows(p_limit integer DEFAULT 10)
RETURNS SETOF public.twenty_workflows LANGUAGE sql SECURITY DEFINER SET search_path = public,pg_temp AS $$
  UPDATE twenty_workflows SET lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds'
  WHERE id IN (SELECT id FROM twenty_workflows WHERE enabled AND (lease_until IS NULL OR lease_until<now())
    ORDER BY updated_at LIMIT LEAST(GREATEST(p_limit,1),20) FOR UPDATE SKIP LOCKED) RETURNING *;
$$;
CREATE FUNCTION public.claim_twenty_jobs(p_limit integer DEFAULT 3)
RETURNS SETOF public.twenty_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
BEGIN
  WITH expired AS (UPDATE twenty_jobs j SET status='unknown_outcome',result='{"error":"AI attempt expired; do not replay"}',lease_token=NULL,lease_until=NULL,updated_at=now()
    WHERE j.status='running' AND j.lease_until<now() AND EXISTS(SELECT 1 FROM twenty_token_reservations r WHERE r.job_id=j.id) RETURNING j.*)
    INSERT INTO twenty_workflow_runs(organization_id,workflow_id,job_id,event) SELECT organization_id,workflow_id,id,'unknown_outcome' FROM expired;
  WITH expired AS (UPDATE twenty_jobs SET status='failed',result='{"error":"retry_limit_reached"}',lease_token=NULL,lease_until=NULL,updated_at=now()
    WHERE status='running' AND lease_until<now() AND attempts>=5 RETURNING *)
    INSERT INTO twenty_workflow_runs(organization_id,workflow_id,job_id,event) SELECT organization_id,workflow_id,id,'retry_limit_reached' FROM expired;
  RETURN QUERY UPDATE twenty_jobs SET status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '240 seconds',updated_at=now()
  WHERE id IN (SELECT id FROM twenty_jobs WHERE attempts<5 AND next_attempt_at<=now()
    AND (status='queued' OR (status='running' AND lease_until<now()))
    ORDER BY next_attempt_at LIMIT LEAST(GREATEST(p_limit,1),5) FOR UPDATE SKIP LOCKED) RETURNING *;
END
$$;
CREATE FUNCTION public.twenty_observe_record(p_org uuid,p_workflow uuid,p_token uuid,p_record uuid,p_version timestamptz,p_ready boolean DEFAULT NULL,p_baseline boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w twenty_workflows; previous twenty_mailbox_states; should_enqueue boolean; inserted uuid;
BEGIN
  SELECT * INTO w FROM twenty_workflows WHERE id=p_workflow AND organization_id=p_org AND enabled
    AND lease_token=p_token AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'poll_lease_lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM twenty_connections WHERE id=w.connection_id AND organization_id=p_org AND revision=w.connection_revision AND status='verified') THEN
    RAISE EXCEPTION 'connection_changed'; END IF;
  should_enqueue:=NOT p_baseline;
  IF w.kind='mailbox_ready' THEN
    SELECT * INTO previous FROM twenty_mailbox_states WHERE workflow_id=w.id AND record_id=p_record FOR UPDATE;
    IF previous.record_version>p_version THEN RETURN false; END IF;
    should_enqueue:=NOT p_baseline AND coalesce(p_ready,false) AND NOT coalesce(previous.ready,false);
    INSERT INTO twenty_mailbox_states(organization_id,workflow_id,record_id,ready,record_version) VALUES(p_org,w.id,p_record,coalesce(p_ready,false),p_version)
      ON CONFLICT(workflow_id,record_id) DO UPDATE SET ready=EXCLUDED.ready,record_version=EXCLUDED.record_version;
  END IF;
  IF should_enqueue THEN
    INSERT INTO twenty_jobs(organization_id,connection_id,connection_revision,workflow_id,owner_id,kind,record_id,record_version,payload,dedupe_key)
    VALUES(p_org,w.connection_id,w.connection_revision,w.id,w.owner_id,w.kind,p_record,p_version,'{}',w.id||':'||w.connection_revision||':'||p_record||':'||p_version)
    ON CONFLICT(organization_id,dedupe_key) DO NOTHING RETURNING id INTO inserted;
  END IF;
  RETURN inserted IS NOT NULL;
END $$;
CREATE FUNCTION public.twenty_stage_job_approval(p_org uuid,p_job uuid,p_token uuid,p_tool text,p_input jsonb,p_diff jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j twenty_jobs; a uuid;
BEGIN
  SELECT * INTO j FROM twenty_jobs WHERE id=p_job AND organization_id=p_org AND status='running'
    AND lease_token=p_token AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_lease_lost'; END IF;
  IF NOT EXISTS (SELECT 1 FROM twenty_connections c JOIN profiles p ON p.id=j.owner_id
    JOIN auth.users u ON u.id=p.id WHERE c.id=j.connection_id AND c.organization_id=p_org
    AND c.revision=j.connection_revision AND c.status='verified' AND p.organization_id=p_org
    AND p.role IN ('owner','admin') AND p.email NOT LIKE '%@guest.local' AND u.email NOT LIKE '%@guest.local' AND NOT coalesce(u.is_anonymous,false)) THEN
    RAISE EXCEPTION 'connection_or_owner_changed';
  END IF;
  IF j.workflow_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM twenty_workflows WHERE id=j.workflow_id AND enabled AND connection_revision=j.connection_revision AND owner_id=j.owner_id) THEN
    RAISE EXCEPTION 'workflow_disabled_or_changed'; END IF;
  INSERT INTO copilot_approvals(organization_id,user_id,conversation_id,task_id,source,crm_source,connection_id,
    connection_revision,workflow_job_id,tool_call_id,tool_name,input,diff)
  VALUES(p_org,j.owner_id,NULL,NULL,'workflow','twenty',j.connection_id,j.connection_revision,j.id,
    'twenty-job:'||j.id,p_tool,p_input,p_diff) ON CONFLICT (organization_id,tool_call_id) DO NOTHING RETURNING id INTO a;
  IF a IS NULL THEN SELECT id INTO a FROM copilot_approvals WHERE organization_id=p_org AND tool_call_id='twenty-job:'||j.id; END IF;
  UPDATE twenty_jobs SET status='awaiting_approval',approval_id=a,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=j.id;
  INSERT INTO twenty_workflow_runs(organization_id,workflow_id,job_id,event) VALUES(p_org,j.workflow_id,j.id,'approval_proposed');
  RETURN a;
END $$;
CREATE FUNCTION public.reserve_twenty_tokens(p_org uuid,p_job uuid,p_token uuid,p_tokens integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j twenty_jobs; cap bigint; month_start date:=date_trunc('month',now() AT TIME ZONE 'UTC')::date; reservation uuid; spent bigint;
BEGIN
  IF p_tokens<1 OR p_tokens>50000 THEN RAISE EXCEPTION 'invalid_reservation'; END IF;
  SELECT * INTO j FROM twenty_jobs WHERE id=p_job AND organization_id=p_org AND status='running'
    AND lease_token=p_token AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_lease_lost'; END IF;
  SELECT monthly_token_cap INTO cap FROM twenty_connections WHERE id=j.connection_id AND organization_id=p_org
    AND revision=j.connection_revision AND status='verified' FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=j.owner_id AND p.organization_id=p_org
    AND p.role IN ('owner','admin') AND p.email NOT LIKE '%@guest.local' AND u.email NOT LIKE '%@guest.local' AND NOT coalesce(u.is_anonymous,false)) THEN RAISE EXCEPTION 'owner_changed'; END IF;
  IF cap IS NULL OR cap<1 OR NOT EXISTS(SELECT 1 FROM twenty_workflows WHERE id=j.workflow_id AND enabled AND kind='qualification') THEN
    RAISE EXCEPTION 'scheduled_ai_disabled'; END IF;
  IF EXISTS(SELECT 1 FROM twenty_token_reservations WHERE job_id=j.id) THEN RAISE EXCEPTION 'ai_attempt_already_reserved'; END IF;
  INSERT INTO twenty_token_usage(connection_id,month) VALUES(j.connection_id,month_start) ON CONFLICT DO NOTHING;
  SELECT used INTO spent FROM twenty_token_usage WHERE connection_id=j.connection_id AND month=month_start FOR UPDATE;
  IF spent+p_tokens>cap THEN RAISE EXCEPTION 'monthly_token_cap_exceeded'; END IF;
  UPDATE twenty_token_usage SET used=used+p_tokens WHERE connection_id=j.connection_id AND month=month_start;
  INSERT INTO twenty_token_reservations(connection_id,job_id,month,reserved) VALUES(j.connection_id,j.id,month_start,p_tokens) RETURNING id INTO reservation;
  RETURN reservation;
END $$;
CREATE FUNCTION public.settle_twenty_tokens(p_org uuid,p_job uuid,p_reservation uuid,p_actual integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r twenty_token_reservations;
BEGIN
  SELECT r0.* INTO r FROM twenty_token_reservations r0 JOIN twenty_jobs j ON j.id=r0.job_id
    WHERE r0.id=p_reservation AND j.id=p_job AND j.organization_id=p_org AND NOT r0.settled FOR UPDATE OF r0;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_actual<0 OR p_actual>r.reserved THEN RAISE EXCEPTION 'invalid_token_usage'; END IF;
  UPDATE twenty_token_usage SET used=used-r.reserved+p_actual WHERE connection_id=r.connection_id AND month=r.month;
  UPDATE twenty_token_reservations SET settled=true WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.claim_twenty_workflows(integer),public.claim_twenty_jobs(integer),public.twenty_observe_record(uuid,uuid,uuid,uuid,timestamptz,boolean,boolean),public.twenty_stage_job_approval(uuid,uuid,uuid,text,jsonb,jsonb),public.reserve_twenty_tokens(uuid,uuid,uuid,integer),public.settle_twenty_tokens(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_twenty_workflows(integer),public.claim_twenty_jobs(integer),public.twenty_observe_record(uuid,uuid,uuid,uuid,timestamptz,boolean,boolean),public.twenty_stage_job_approval(uuid,uuid,uuid,text,jsonb,jsonb),public.reserve_twenty_tokens(uuid,uuid,uuid,integer),public.settle_twenty_tokens(uuid,uuid,uuid,integer) TO service_role;
COMMIT;
