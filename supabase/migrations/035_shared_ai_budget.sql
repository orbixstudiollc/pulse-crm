-- ============================================================
-- 035 Shared AI budget: lock ai_usage_log writes, atomic token counter
--
-- Fixes (security review of 5320f2a..e6e673d):
--   (C1) Any org member could INSERT ai_usage_log rows through the user
--        client (policy "Users can insert usage logs", 011). Negative or
--        future-dated total_tokens gave the org an unlimited shared-key
--        budget, or exhausted the site-wide budget for everyone. The INSERT
--        policy is dropped and INSERT/UPDATE/DELETE revoked from anon and
--        authenticated; the app writes usage with the service role. The
--        SELECT policy stays. Rows already planted (negative tokens, or
--        created_at more than a day ahead) are deleted, and a CHECK keeps
--        token counts non-negative from now on.
--   (H3) Check-then-charge let concurrent requests all pass the budget
--        check. The shared-key budget now lives in ai_shared_budget, one row
--        per (scope, UTC day) where scope is 'site' or an organization id,
--        and is charged by reserve_shared_ai_tokens() BEFORE the AI call:
--        both rows are locked (site first, then org, so callers never
--        deadlock), checked against the limits and incremented in one
--        transaction. settle_shared_ai_tokens() then corrects the
--        reservation to actual usage (a negative delta refunds), never
--        below 0.
--   (M3) The site-wide SUM over ai_usage_log is no longer needed for
--        budgets, so no partial index is added.
--
-- ai_shared_budget has RLS enabled with NO policies and no anon/authenticated
-- privileges: only the service role (and the SECURITY DEFINER functions)
-- can touch it. Both functions are executable by service_role only.
--
-- Runs as one transaction. Safe to re-run: DROP POLICY IF EXISTS,
-- REVOKE/GRANT, the DELETE, DROP CONSTRAINT IF EXISTS + ADD,
-- CREATE TABLE IF NOT EXISTS and CREATE OR REPLACE FUNCTION are idempotent.
-- Apply by hand in the Supabase SQL editor (paste the whole file, Run).
-- ============================================================

BEGIN;


-- ─── (C1) ai_usage_log: no tenant writes ────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert usage logs" ON public.ai_usage_log;

REVOKE INSERT, UPDATE, DELETE ON public.ai_usage_log FROM anon, authenticated;

DELETE FROM public.ai_usage_log
 WHERE input_tokens < 0
    OR output_tokens < 0
    OR total_tokens < 0
    OR created_at > now() + interval '1 day';

ALTER TABLE public.ai_usage_log
  DROP CONSTRAINT IF EXISTS ai_usage_log_tokens_nonnegative;

ALTER TABLE public.ai_usage_log
  ADD CONSTRAINT ai_usage_log_tokens_nonnegative
  CHECK (input_tokens >= 0 AND output_tokens >= 0 AND total_tokens >= 0);


-- ─── (H3) ai_shared_budget: per-day counters, service role only ─────────────

CREATE TABLE IF NOT EXISTS public.ai_shared_budget (
  scope      text        NOT NULL,  -- 'site' or an organization uuid as text
  day        date        NOT NULL,  -- UTC day
  used       bigint      NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, day)
);

ALTER TABLE public.ai_shared_budget ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_shared_budget FROM anon, authenticated;


-- reserve_shared_ai_tokens: charge p_tokens to today's site and org counters
-- if both stay within their limits. Returns 'ok', 'org_limit' or
-- 'site_limit'; nothing is charged unless it returns 'ok'.
CREATE OR REPLACE FUNCTION public.reserve_shared_ai_tokens(
  p_org        uuid,
  p_tokens     integer,
  p_org_limit  bigint,
  p_site_limit bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day       date := (now() AT TIME ZONE 'utc')::date;
  v_site_used bigint;
  v_org_used  bigint;
BEGIN
  IF p_org IS NULL OR p_tokens IS NULL OR p_org_limit IS NULL OR p_site_limit IS NULL THEN
    RAISE EXCEPTION 'reserve_shared_ai_tokens: arguments must not be null';
  END IF;
  IF p_tokens <= 0 THEN
    RAISE EXCEPTION 'reserve_shared_ai_tokens: p_tokens must be positive, got %', p_tokens;
  END IF;

  INSERT INTO ai_shared_budget (scope, day)
  VALUES ('site', v_day), (p_org::text, v_day)
  ON CONFLICT (scope, day) DO NOTHING;

  -- Fixed lock order (site, then org) so concurrent callers cannot deadlock.
  SELECT used INTO v_site_used
    FROM ai_shared_budget
   WHERE scope = 'site' AND day = v_day
     FOR UPDATE;

  SELECT used INTO v_org_used
    FROM ai_shared_budget
   WHERE scope = p_org::text AND day = v_day
     FOR UPDATE;

  IF v_org_used + p_tokens > p_org_limit THEN
    RETURN 'org_limit';
  END IF;
  IF v_site_used + p_tokens > p_site_limit THEN
    RETURN 'site_limit';
  END IF;

  UPDATE ai_shared_budget
     SET used = used + p_tokens, updated_at = now()
   WHERE day = v_day AND scope IN ('site', p_org::text);

  RETURN 'ok';
END;
$$;


-- settle_shared_ai_tokens: add p_delta (actual minus reserved; negative is a
-- refund) to the site and org counters of p_day, never below 0. NULLs are
-- rejected because GREATEST ignores NULL and would reset the counters to 0.
CREATE OR REPLACE FUNCTION public.settle_shared_ai_tokens(
  p_org   uuid,
  p_day   date,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_org IS NULL OR p_day IS NULL OR p_delta IS NULL THEN
    RAISE EXCEPTION 'settle_shared_ai_tokens: arguments must not be null';
  END IF;

  -- Two statements to keep the site-then-org lock order of reserve.
  UPDATE ai_shared_budget
     SET used = GREATEST(used + p_delta, 0), updated_at = now()
   WHERE scope = 'site' AND day = p_day;

  UPDATE ai_shared_budget
     SET used = GREATEST(used + p_delta, 0), updated_at = now()
   WHERE scope = p_org::text AND day = p_day;
END;
$$;


-- ─── Function grants: service_role only (see 030 A5) ────────────────────────

REVOKE EXECUTE ON FUNCTION public.reserve_shared_ai_tokens(uuid, integer, bigint, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_shared_ai_tokens(uuid, integer, bigint, bigint)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.settle_shared_ai_tokens(uuid, date, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_shared_ai_tokens(uuid, date, integer)
  TO service_role;

COMMIT;
