-- ============================================================
-- 038 Shared AI budget: lock ai_usage_log writes, atomic token counter
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
-- Revised before first apply (review of abae699 + 02fe2f7):
--   (N1) Guest workspaces are free, so guests could lock the whole site
--        budget for the day with reservations that never settle. Guest
--        calls (p_is_guest) also charge a shared third row, scope 'guest',
--        capped by p_guest_limit; reserve returns 'guest_limit' when that
--        pool is full while the org and site still have room. Lock order
--        everywhere is site, then guest, then org. Non-guest calls never
--        create, lock or change the guest row.
--   (N3) reserve returns the UTC day it charged (computed from the
--        database's now()), so settle targets exactly that row.
--   (N6) purge_shared_ai_budget(p_keep_days) deletes counter rows older
--        than the current UTC day minus p_keep_days and returns the count.
--
-- ai_shared_budget has RLS enabled with NO policies and no anon/authenticated
-- privileges: only the service role (and the SECURITY DEFINER functions)
-- can touch it. All three functions are executable by service_role only.
--
-- Runs as one transaction. Safe to re-run: DROP POLICY IF EXISTS,
-- REVOKE/GRANT, the DELETE, DROP CONSTRAINT IF EXISTS + ADD,
-- CREATE TABLE IF NOT EXISTS, DROP FUNCTION IF EXISTS (the earlier
-- reserve/settle signatures) and CREATE OR REPLACE FUNCTION are idempotent.
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


-- Earlier signatures (never applied to production); dropped so a database
-- that already has them ends up with only the current ones.
DROP FUNCTION IF EXISTS public.reserve_shared_ai_tokens(uuid, integer, bigint, bigint);
DROP FUNCTION IF EXISTS public.settle_shared_ai_tokens(uuid, date, integer);


-- reserve_shared_ai_tokens: charge p_tokens to today's site and org counters,
-- and to the 'guest' pool when p_is_guest, if every one of them stays within
-- its limit. result is 'ok', 'org_limit', 'guest_limit' or 'site_limit'
-- (checked in that order); nothing is charged unless it is 'ok'. day is the
-- UTC day evaluated (and, on 'ok', charged); pass it to settle.
-- Column references are table-qualified because the OUT column "day"
-- shares its name with ai_shared_budget.day.
CREATE OR REPLACE FUNCTION public.reserve_shared_ai_tokens(
  p_org         uuid,
  p_tokens      integer,
  p_org_limit   bigint,
  p_site_limit  bigint,
  p_is_guest    boolean,
  p_guest_limit bigint
)
RETURNS TABLE (result text, day date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day        date := (now() AT TIME ZONE 'utc')::date;
  v_site_used  bigint;
  v_guest_used bigint;
  v_org_used   bigint;
BEGIN
  IF p_org IS NULL OR p_tokens IS NULL OR p_org_limit IS NULL OR p_site_limit IS NULL
     OR p_is_guest IS NULL OR p_guest_limit IS NULL THEN
    RAISE EXCEPTION 'reserve_shared_ai_tokens: arguments must not be null';
  END IF;
  IF p_tokens <= 0 THEN
    RAISE EXCEPTION 'reserve_shared_ai_tokens: p_tokens must be positive, got %', p_tokens;
  END IF;

  -- Rows listed in lock order (site, guest, org).
  IF p_is_guest THEN
    INSERT INTO ai_shared_budget AS b (scope, day)
    VALUES ('site', v_day), ('guest', v_day), (p_org::text, v_day)
    ON CONFLICT ON CONSTRAINT ai_shared_budget_pkey DO NOTHING;
  ELSE
    INSERT INTO ai_shared_budget AS b (scope, day)
    VALUES ('site', v_day), (p_org::text, v_day)
    ON CONFLICT ON CONSTRAINT ai_shared_budget_pkey DO NOTHING;
  END IF;

  -- Fixed lock order (site, then guest, then org) so callers cannot deadlock.
  SELECT b.used INTO v_site_used
    FROM ai_shared_budget b
   WHERE b.scope = 'site' AND b.day = v_day
     FOR UPDATE;

  IF p_is_guest THEN
    SELECT b.used INTO v_guest_used
      FROM ai_shared_budget b
     WHERE b.scope = 'guest' AND b.day = v_day
       FOR UPDATE;
  END IF;

  SELECT b.used INTO v_org_used
    FROM ai_shared_budget b
   WHERE b.scope = p_org::text AND b.day = v_day
     FOR UPDATE;

  IF v_org_used + p_tokens > p_org_limit THEN
    RETURN QUERY SELECT 'org_limit'::text, v_day;
    RETURN;
  END IF;
  IF p_is_guest AND v_guest_used + p_tokens > p_guest_limit THEN
    RETURN QUERY SELECT 'guest_limit'::text, v_day;
    RETURN;
  END IF;
  IF v_site_used + p_tokens > p_site_limit THEN
    RETURN QUERY SELECT 'site_limit'::text, v_day;
    RETURN;
  END IF;

  UPDATE ai_shared_budget b
     SET used = b.used + p_tokens, updated_at = now()
   WHERE b.day = v_day
     AND (b.scope IN ('site', p_org::text) OR (p_is_guest AND b.scope = 'guest'));

  RETURN QUERY SELECT 'ok'::text, v_day;
END;
$$;


-- settle_shared_ai_tokens: add p_delta (actual minus reserved; negative is a
-- refund) to the site and org counters of p_day, and to the 'guest' pool when
-- p_is_guest, never below 0. NULLs are rejected because GREATEST ignores NULL
-- and would reset the counters to 0.
CREATE OR REPLACE FUNCTION public.settle_shared_ai_tokens(
  p_org      uuid,
  p_day      date,
  p_delta    integer,
  p_is_guest boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_org IS NULL OR p_day IS NULL OR p_delta IS NULL OR p_is_guest IS NULL THEN
    RAISE EXCEPTION 'settle_shared_ai_tokens: arguments must not be null';
  END IF;

  -- Separate statements to keep the site, guest, org lock order of reserve.
  UPDATE ai_shared_budget
     SET used = GREATEST(used + p_delta, 0), updated_at = now()
   WHERE scope = 'site' AND day = p_day;

  IF p_is_guest THEN
    UPDATE ai_shared_budget
       SET used = GREATEST(used + p_delta, 0), updated_at = now()
     WHERE scope = 'guest' AND day = p_day;
  END IF;

  UPDATE ai_shared_budget
     SET used = GREATEST(used + p_delta, 0), updated_at = now()
   WHERE scope = p_org::text AND day = p_day;
END;
$$;


-- purge_shared_ai_budget: delete counter rows of every scope whose day is
-- before the current UTC day minus p_keep_days (0 keeps only today). Returns
-- the number of rows deleted. A negative p_keep_days would delete today's
-- live counters, so it is rejected.
CREATE OR REPLACE FUNCTION public.purge_shared_ai_budget(
  p_keep_days integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_keep_days IS NULL OR p_keep_days < 0 THEN
    RAISE EXCEPTION 'purge_shared_ai_budget: p_keep_days must be a non-negative integer, got %', p_keep_days;
  END IF;

  DELETE FROM ai_shared_budget
   WHERE day < (now() AT TIME ZONE 'utc')::date - p_keep_days;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$;


-- ─── Function grants: service_role only (see 030 A5) ────────────────────────

REVOKE EXECUTE ON FUNCTION public.reserve_shared_ai_tokens(uuid, integer, bigint, bigint, boolean, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_shared_ai_tokens(uuid, integer, bigint, bigint, boolean, bigint)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.settle_shared_ai_tokens(uuid, date, integer, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_shared_ai_tokens(uuid, date, integer, boolean)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.purge_shared_ai_budget(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_shared_ai_budget(integer)
  TO service_role;

COMMIT;
