-- ============================================================================
-- tenant_isolation_check.sql  --  READ-ONLY cross-tenant access check
--
-- What it does
--   Lists, for schema public, everything that decides whether one
--   organization can read another organization's rows through the Supabase
--   Data API (roles anon and authenticated), and marks what looks wrong.
--   It is a single SELECT over the catalogs (pg_class, pg_attribute,
--   pg_policies, pg_proc, pg_roles). No DDL, no DML, no temp tables, no DO
--   blocks, no dynamic SQL, and it reads no application table rows.
--
-- How to use it
--   1. Supabase Dashboard -> SQL Editor -> New query.
--   2. Paste this whole file and click Run. It is ONE statement because the
--      editor only displays the last statement's result.
--   3. Read the "problem" column first. Rows are sorted by section, then
--      HIGH before REVIEW before fine (problem empty).
--        HIGH    almost certainly lets data cross tenants (or lets a
--                SECURITY DEFINER function be hijacked); fix it.
--        REVIEW  not proven wrong, but a person has to look at it.
--        (empty) nothing found.
--      Tip: filter the grid on problem IS NOT NULL, or add
--      WHERE problem IS NOT NULL before the final ORDER BY.
--
-- Sections (column "section")
--   0_summary    how many HIGH / REVIEW rows each section has.
--   1_tables     one row per table, view and materialized view in public:
--                rls_enabled, policy count, whether it has an organization_id
--                column, and what anon / authenticated may do (detail).
--                HIGH: RLS disabled while anon or authenticated hold
--                privileges (every row is open through the API); a view
--                without security_invoker, or a materialized view, that
--                anon or authenticated can SELECT (views run as their owner
--                and skip RLS). REVIEW: RLS disabled but no API privileges.
--   2_policies   one row per policy: cmd, roles, qual (USING), with_check.
--                HIGH: the table has an organization_id column and a
--                PERMISSIVE SELECT/ALL policy for anon, authenticated or
--                public whose USING does not mention organization_id or
--                auth.uid() (example: USING (true)), so any signed-in user
--                of any org reads those rows. REVIEW: the same pattern on a
--                table without organization_id. Policies whose USING is only
--                auth.role() = 'service_role' (or the auth.jwt() role claim)
--                are not flagged; restrictive policies never grant reads.
--   3_anon_grants table and column privileges held by anon (or PUBLIC,
--                which anon inherits), one row per table or column and
--                grantee; cmd lists the privileges. Supabase grants these by
--                default, so
--                a grant alone is normal: RLS decides the rows. HIGH when the
--                grant reaches rows RLS does not guard (RLS disabled, a view
--                without security_invoker, a materialized view).
--   4_functions  SECURITY DEFINER functions in public that anon or
--                authenticated can EXECUTE, with their search_path setting.
--                They run as their owner and bypass RLS. HIGH: no SET
--                search_path. REVIEW: the body never checks auth.uid(),
--                auth.jwt(), auth.role() or organization_id; or anon can
--                call it. Trigger functions cannot be called through the
--                API, so only the search_path rule applies to them.
--
-- Limits
--   * Policy and function checks are text matches on the deparsed
--     expression, not proofs: "organization_id = organization_id" passes,
--     and a helper function that scopes correctly may be flagged REVIEW.
--   * Only schema public. storage.objects policies are not checked here.
--   * Privileges are checked for the roles anon and authenticated; if a role
--     does not exist, its columns are simply empty.
-- ============================================================================

WITH
api_role AS (
  SELECT r.oid, r.rolname FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated')
),

rel AS (
  SELECT
    c.oid,
    c.relname,
    c.relkind,
    CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view' ELSE 'table' END AS relkind_name,
    c.relrowsecurity      AS rls,
    c.relforcerowsecurity AS force_rls,
    coalesce(c.reloptions && ARRAY['security_invoker=true', 'security_invoker=on', 'security_invoker=1'], false)
                          AS security_invoker,
    EXISTS (SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = c.oid AND a.attname = 'organization_id'
              AND a.attnum > 0 AND NOT a.attisdropped) AS has_org,
    (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS n_policies,
    (SELECT string_agg(u.pr, ',' ORDER BY u.ord)
       FROM api_role r, unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) WITH ORDINALITY u(pr, ord)
      WHERE r.rolname = 'anon' AND has_table_privilege(r.oid, c.oid, u.pr)) AS anon_privs,
    (SELECT string_agg(u.pr, ',' ORDER BY u.ord)
       FROM api_role r, unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) WITH ORDINALITY u(pr, ord)
      WHERE r.rolname = 'authenticated' AND has_table_privilege(r.oid, c.oid, u.pr)) AS auth_privs
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
),

tables_report AS (
  SELECT
    '1_tables'::text AS section,
    format('public.%I (%s)', r.relname, r.relkind_name) AS object,
    CASE WHEN r.relkind IN ('r', 'p') THEN r.rls END AS rls_enabled,
    NULL::text AS cmd,
    NULL::text AS roles,
    NULL::text AS qual,
    NULL::text AS with_check,
    format('policies=%s; organization_id column=%s; force_rls=%s; anon may %s; authenticated may %s%s',
           r.n_policies, r.has_org, r.force_rls,
           coalesce(r.anon_privs, 'nothing'), coalesce(r.auth_privs, 'nothing'),
           CASE WHEN r.relkind = 'v' THEN format('; security_invoker=%s', r.security_invoker) ELSE '' END) AS detail,
    CASE
      WHEN r.relkind IN ('r', 'p') AND NOT r.rls AND (r.anon_privs IS NOT NULL OR r.auth_privs IS NOT NULL)
        THEN 'HIGH: RLS disabled and anon/authenticated hold privileges: every organization''s rows are open through the API'
      WHEN r.relkind IN ('r', 'p') AND NOT r.rls
        THEN 'REVIEW: RLS disabled (anon/authenticated hold no privileges today); enable RLS before anything is granted'
      WHEN r.relkind = 'v' AND NOT r.security_invoker
           AND (r.anon_privs LIKE '%SELECT%' OR r.auth_privs LIKE '%SELECT%')
        THEN 'HIGH: view runs as its owner (no security_invoker), so RLS of the tables under it does not apply to anon/authenticated'
      WHEN r.relkind = 'm' AND (r.anon_privs LIKE '%SELECT%' OR r.auth_privs LIKE '%SELECT%')
        THEN 'HIGH: materialized view has no RLS and anon/authenticated can SELECT every row'
    END AS problem
  FROM rel r
),

policies_report AS (
  SELECT
    '2_policies'::text AS section,
    format('public.%I: "%s"', p.tablename, p.policyname) AS object,
    r.rls AS rls_enabled,
    p.cmd::text AS cmd,
    array_to_string(p.roles, ',') AS roles,
    p.qual,
    p.with_check,
    format('%s; organization_id column=%s%s', p.permissive, r.has_org,
           CASE WHEN NOT r.rls THEN '; table has RLS disabled, so this policy is not enforced' ELSE '' END) AS detail,
    CASE
      WHEN p.permissive = 'PERMISSIVE'
       AND p.cmd IN ('SELECT', 'ALL')
       AND p.roles && ARRAY['anon', 'authenticated', 'public']::name[]
       AND p.qual IS NOT NULL
       AND p.qual !~* 'organization_id|auth\.uid\(\)'
       AND p.qual !~* '^[( ]*(select +)?(auth\.role\(\)|auth\.jwt\(\) ->> ''role''::text)( as role)?[) ]*= ''service_role''::text[) ]*$'
      THEN CASE WHEN r.has_org
             THEN 'HIGH: cross-tenant read: this policy lets anon/authenticated SELECT rows and its USING never checks organization_id or auth.uid()'
             ELSE 'REVIEW: SELECT policy for anon/authenticated whose USING never checks organization_id or auth.uid(); confirm the table holds no tenant data'
           END
    END AS problem
  FROM pg_policies p
  JOIN rel r ON r.relname = p.tablename
  WHERE p.schemaname = 'public'
),

anon_grant AS (
  SELECT c.oid AS relid, NULL::name AS colname, a.privilege_type, a.grantee
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE n.nspname = 'public'
    AND (a.grantee = 0 OR a.grantee IN (SELECT r.oid FROM api_role r WHERE r.rolname = 'anon'))
  UNION ALL
  SELECT at.attrelid, at.attname, a.privilege_type, a.grantee
  FROM pg_attribute at
  JOIN pg_class c ON c.oid = at.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(at.attacl) a
  WHERE n.nspname = 'public' AND at.attnum > 0 AND NOT at.attisdropped
    AND (a.grantee = 0 OR a.grantee IN (SELECT r.oid FROM api_role r WHERE r.rolname = 'anon'))
),

grants_report AS (
  SELECT
    '3_anon_grants'::text AS section,
    CASE WHEN g.colname IS NULL THEN format('public.%I', c.relname)
         ELSE format('public.%I.%I', c.relname, g.colname) END AS object,
    CASE WHEN c.relkind IN ('r', 'p') THEN c.relrowsecurity END AS rls_enabled,
    string_agg(g.privilege_type, ',' ORDER BY g.privilege_type) AS cmd,
    CASE WHEN g.grantee = 0 THEN 'PUBLIC' ELSE 'anon' END AS roles,
    NULL::text AS qual,
    NULL::text AS with_check,
    format('%s grant on a %s', CASE WHEN g.colname IS NULL THEN 'table' ELSE 'column' END,
           CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned table' WHEN 'v' THEN 'view'
                          WHEN 'm' THEN 'materialized view' WHEN 'S' THEN 'sequence' WHEN 'f' THEN 'foreign table'
                          ELSE c.relkind::text END) AS detail,
    CASE
      WHEN c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
        THEN 'HIGH: anon holds privileges on a table with RLS disabled: no login needed to reach every row'
      WHEN c.relkind = 'v' AND bool_or(g.privilege_type = 'SELECT')
           AND NOT coalesce(c.reloptions && ARRAY['security_invoker=true', 'security_invoker=on', 'security_invoker=1'], false)
        THEN 'HIGH: anon can SELECT a view that runs as its owner (no security_invoker), bypassing RLS'
      WHEN c.relkind = 'm' AND bool_or(g.privilege_type = 'SELECT')
        THEN 'HIGH: anon can SELECT a materialized view, which has no RLS'
    END AS problem
  FROM anon_grant g
  JOIN pg_class c ON c.oid = g.relid
  GROUP BY c.oid, c.relname, c.relkind, c.relrowsecurity, c.reloptions, g.colname, g.grantee
),

secdef AS (
  SELECT
    p.oid,
    p.oid::regprocedure::text AS signature,
    p.prosrc,
    p.prorettype IN ('trigger'::regtype, 'event_trigger'::regtype) AS is_trigger,
    (SELECT cfg FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%' LIMIT 1) AS search_path,
    EXISTS (SELECT 1 FROM api_role r WHERE r.rolname = 'anon' AND has_function_privilege(r.oid, p.oid, 'EXECUTE')) AS anon_exec,
    EXISTS (SELECT 1 FROM api_role r WHERE r.rolname = 'authenticated' AND has_function_privilege(r.oid, p.oid, 'EXECUTE')) AS auth_exec,
    p.prorettype::regtype::text AS returns
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
),

functions_report AS (
  SELECT
    '4_functions'::text AS section,
    format('public.%s', f.signature) AS object,
    NULL::boolean AS rls_enabled,
    'EXECUTE'::text AS cmd,
    concat_ws(',', CASE WHEN f.anon_exec THEN 'anon' END, CASE WHEN f.auth_exec THEN 'authenticated' END) AS roles,
    NULL::text AS qual,
    NULL::text AS with_check,
    format('SECURITY DEFINER; %s; returns %s%s',
           coalesce(f.search_path, 'search_path NOT SET'), f.returns,
           CASE WHEN f.is_trigger THEN ' (trigger function: not callable through the API)' ELSE '' END) AS detail,
    nullif(concat_ws('; ',
      CASE WHEN f.search_path IS NULL
           THEN 'HIGH: no SET search_path, so a caller-controlled search_path can hijack it while it runs as owner' END,
      CASE WHEN NOT f.is_trigger AND f.prosrc !~* 'auth\.uid\(\)|auth\.jwt\(\)|auth\.role\(\)|organization_id'
           THEN 'REVIEW: runs as owner (bypasses RLS) and its body never checks auth.uid()/auth.jwt()/auth.role() or organization_id' END,
      CASE WHEN NOT f.is_trigger AND f.anon_exec
           THEN 'REVIEW: anon (not signed in) can call it; REVOKE EXECUTE ... FROM PUBLIC, anon unless that is intended' END
    ), '') AS problem
  FROM secdef f
  WHERE f.anon_exec OR f.auth_exec
),

report AS (
  SELECT * FROM tables_report
  UNION ALL SELECT * FROM policies_report
  UNION ALL SELECT * FROM grants_report
  UNION ALL SELECT * FROM functions_report
),

summary AS (
  SELECT '0_summary'::text AS section,
         s.section AS object,
         NULL::boolean AS rls_enabled, NULL::text AS cmd, NULL::text AS roles,
         NULL::text AS qual, NULL::text AS with_check,
         format('%s rows checked', count(r.section)) AS detail,
         CASE WHEN count(r.problem) > 0
              THEN format('%s HIGH, %s REVIEW',
                          count(*) FILTER (WHERE r.problem LIKE 'HIGH%'),
                          count(*) FILTER (WHERE r.problem LIKE 'REVIEW%'))
         END AS problem
  FROM (VALUES ('1_tables'), ('2_policies'), ('3_anon_grants'), ('4_functions')) s(section)
  LEFT JOIN report r ON r.section = s.section
  GROUP BY s.section
)

SELECT * FROM (
  SELECT * FROM summary
  UNION ALL
  SELECT * FROM report
) x
ORDER BY section,
         CASE WHEN problem LIKE 'HIGH%' THEN 0 WHEN problem IS NOT NULL THEN 1 ELSE 2 END,
         object;
