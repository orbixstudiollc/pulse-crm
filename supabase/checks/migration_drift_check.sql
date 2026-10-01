-- ============================================================================
-- migration_drift_check.sql  --  READ-ONLY schema drift check
--
-- What it does
--   Compares the live database with what supabase/migrations/*.sql should have
--   produced, and reports which migrations were never applied (or only partly).
--   It only reads the catalogs (pg_catalog, pg_policies, storage.buckets) and
--   is a single SELECT. No DDL, no DML, no temp tables, no DO blocks, no
--   dynamic SQL, and it reads no application table rows (catalog-only).
--
-- How to use it
--   1. Supabase Dashboard -> SQL Editor -> New query.
--   2. Paste this whole file and click Run. It is ONE statement, so the
--      editor shows the full report (the editor only displays the last
--      statement's result, which is why nothing is split into separate queries).
--   3. Read the result top-down; rows are grouped by the "section" column:
--        1_summary     one row per migration with at least one failing check;
--                      "all checks failing" means the file was probably never
--                      applied. No row here = no drift found.
--        2_unexpected  policies that exist in the database (schemas public and
--                      storage) but that no repo migration defines, i.e. created
--                      in the dashboard or by hand.
--        3_detail      every check, ordered by migration (the order they were
--                      applied), with present / expected / status.
--      Status values: OK, MISSING (should exist, doesn't), SHOULD_BE_ABSENT
--      (a later migration drops it but it is still there), SKIPPED (the object
--      a check depends on is missing; its own MISSING row explains why).
--   Tip: to see only problems, add  WHERE status <> 'OK'  before the final
--   ORDER BY, or filter the result grid.
--
-- What is checked, per migration
--   enum, table, column (ALTER TABLE ... ADD COLUMN), column default (035),
--   constraint definition, index, function (by argument signature), function body / config /
--   EXECUTE privilege, column privilege, trigger (by table), trigger enabled
--   (035 disables deals.set_updated_at during its backfill), RLS enabled,
--   policy (name + table), policy definition (WITH CHECK pattern for policies
--   that a later migration re-created), storage bucket.
--   Objects that later migrations drop are NOT expected; the dropping
--   migration instead gets a "policy ... expected absent" check. Objects that
--   later migrations re-create or replace (policies, handle_new_user, the
--   provider CHECK constraints) are checked for the newest definition under
--   the migration that introduced it.
--
-- Order note
--   Migrations are listed in filename order, which is also a valid apply
--   order. 022 and 023 were named 20260313_automation_rules.sql and
--   20260313_multichannel.sql until 2026-10-01; production applied them before
--   028 under those names.

-- Known gaps (not expressible as a catalog check)
--   * 034_normalize_seed_values.sql is data-only (UPDATEs of seeded rows, no
--     schema change), so it has no checks and never appears in the summary.
--   * 030 (A6) backfill of sole members to role 'admin' (a one-off UPDATE).
--   * 035's backfill of deals.stage_changed_at (reading rows is out of scope).
--   * Column types, defaults (except 035's), NOT NULL, FKs and columns
--     defined inside CREATE TABLE are not checked individually (the table
--     check covers them).
--   * 021 copies the 13 tables that were first created by hand in
--     production; it is checked for tables, indexes, triggers, RLS and
--     policies like any other migration.
--   * email_accounts.tracking_domain (mentioned in 031) is created by no
--     migration, so it is not checked.
--
-- To update: when a migration is added, append the file to "migrations" and
-- its objects to "expected". Section 2 builds its policy allow-list from
-- "expected" (plus "retired" for policies a later migration dropped), so new
-- policies need no second entry.
-- ============================================================================

WITH
migrations (ord, file) AS (
  VALUES
    (1, '001_initial_schema.sql'),
    (2, '002_fix_org_insert_rls.sql'),
    (3, '003_lead_scoring.sql'),
    (4, '004_icp_profiles.sql'),
    (5, '005_qualification.sql'),
    (6, '006_sequences.sql'),
    (7, '007_competitive_intel.sql'),
    (8, '008_objections.sql'),
    (9, '009_proposals.sql'),
    (10, '010_phase15_features.sql'),
    (11, '011_ai_foundation.sql'),
    (12, '016_email_system.sql'),
    (13, '017_email_rpc_functions.sql'),
    (14, '020_marketing_suite.sql'),
    (15, '021_unmigrated_tables.sql'),
    (16, '022_automation_rules.sql'),
    (17, '023_multichannel.sql'),
    (18, '025_lead_finder.sql'),
    (19, '026_lead_finder_settings.sql'),
    (20, '027_lead_finder_parity.sql'),
    (21, '028_security_hardening.sql'),
    (22, '029_open_access_guests.sql'),
    (23, '030_followup.sql'),
    (24, '031_account_role_rls.sql'),
    (25, '032_avatar_storage.sql'),
    (26, '033_custom_ai_provider.sql'),
    (27, '034_normalize_seed_values.sql'),
    (28, '035_deal_stage_changed_at.sql'),
    (29, '036_api_keys.sql')
),

-- kind               sch      rel             obj           arg        pat
-- enum/table         schema   -               name          -          -
-- column             schema   table           column        -          -
-- column_default     schema   table           column        -          exact default expression
-- constraint_def     schema   table           conname       -          LIKE pattern on definition
-- index/trigger      schema   table           name          -          -
-- trigger_enabled    schema   table           trigger name  -          - (exists and not DISABLEd)
-- function           schema   -               name          arg types  -
-- function_def       schema   -               name          arg types  ILIKE pattern on body
-- function_config    schema   -               name          arg types  required proconfig entry
-- function_privilege schema   role            name          arg types  privilege
-- column_privilege   schema   table           column        role       privilege
-- rls                schema   table           table         -          -
-- policy             schema   table           policy name   -          -
-- policy_def         schema   table           policy name   -          LIKE pattern on WITH CHECK
-- bucket             storage  buckets         bucket id     -          -
-- expect_present = false means the object must NOT exist (or privilege NOT held).
expected (seq, file, kind, sch, rel, obj, arg, pat, expect_present) AS (
  VALUES
    (1, '001_initial_schema.sql', 'enum', 'public', '', 'customer_status', '', '', true),
    (2, '001_initial_schema.sql', 'enum', 'public', '', 'customer_plan', '', '', true),
    (3, '001_initial_schema.sql', 'enum', 'public', '', 'lead_status', '', '', true),
    (4, '001_initial_schema.sql', 'enum', 'public', '', 'lead_source', '', '', true),
    (5, '001_initial_schema.sql', 'enum', 'public', '', 'deal_stage', '', '', true),
    (6, '001_initial_schema.sql', 'enum', 'public', '', 'activity_type', '', '', true),
    (7, '001_initial_schema.sql', 'enum', 'public', '', 'activity_status', '', '', true),
    (8, '001_initial_schema.sql', 'enum', 'public', '', 'related_entity_type', '', '', true),
    (9, '001_initial_schema.sql', 'table', 'public', '', 'organizations', '', '', true),
    (10, '001_initial_schema.sql', 'table', 'public', '', 'profiles', '', '', true),
    (11, '001_initial_schema.sql', 'table', 'public', '', 'customers', '', '', true),
    (12, '001_initial_schema.sql', 'table', 'public', '', 'customer_custom_fields', '', '', true),
    (13, '001_initial_schema.sql', 'table', 'public', '', 'customer_notes', '', '', true),
    (14, '001_initial_schema.sql', 'table', 'public', '', 'customer_activities', '', '', true),
    (15, '001_initial_schema.sql', 'table', 'public', '', 'leads', '', '', true),
    (16, '001_initial_schema.sql', 'table', 'public', '', 'lead_notes', '', '', true),
    (17, '001_initial_schema.sql', 'table', 'public', '', 'lead_activities', '', '', true),
    (18, '001_initial_schema.sql', 'table', 'public', '', 'deals', '', '', true),
    (19, '001_initial_schema.sql', 'table', 'public', '', 'deal_notes', '', '', true),
    (20, '001_initial_schema.sql', 'table', 'public', '', 'deal_activities', '', '', true),
    (21, '001_initial_schema.sql', 'table', 'public', '', 'activities', '', '', true),
    (22, '001_initial_schema.sql', 'table', 'public', '', 'calendar_events', '', '', true),
    (23, '001_initial_schema.sql', 'table', 'public', '', 'user_integrations', '', '', true),
    (24, '001_initial_schema.sql', 'index', 'public', 'customers', 'idx_customers_org', '', '', true),
    (25, '001_initial_schema.sql', 'index', 'public', 'customers', 'idx_customers_status', '', '', true),
    (26, '001_initial_schema.sql', 'index', 'public', 'customers', 'idx_customers_email', '', '', true),
    (27, '001_initial_schema.sql', 'index', 'public', 'customer_custom_fields', 'idx_custom_fields_customer', '', '', true),
    (28, '001_initial_schema.sql', 'index', 'public', 'customer_notes', 'idx_customer_notes_customer', '', '', true),
    (29, '001_initial_schema.sql', 'index', 'public', 'customer_activities', 'idx_customer_activities_customer', '', '', true),
    (30, '001_initial_schema.sql', 'index', 'public', 'leads', 'idx_leads_org', '', '', true),
    (31, '001_initial_schema.sql', 'index', 'public', 'leads', 'idx_leads_status', '', '', true),
    (32, '001_initial_schema.sql', 'index', 'public', 'leads', 'idx_leads_source', '', '', true),
    (33, '001_initial_schema.sql', 'index', 'public', 'lead_notes', 'idx_lead_notes_lead', '', '', true),
    (34, '001_initial_schema.sql', 'index', 'public', 'lead_activities', 'idx_lead_activities_lead', '', '', true),
    (35, '001_initial_schema.sql', 'index', 'public', 'deals', 'idx_deals_org', '', '', true),
    (36, '001_initial_schema.sql', 'index', 'public', 'deals', 'idx_deals_stage', '', '', true),
    (37, '001_initial_schema.sql', 'index', 'public', 'deals', 'idx_deals_customer', '', '', true),
    (38, '001_initial_schema.sql', 'index', 'public', 'deals', 'idx_deals_owner', '', '', true),
    (39, '001_initial_schema.sql', 'index', 'public', 'deal_notes', 'idx_deal_notes_deal', '', '', true),
    (40, '001_initial_schema.sql', 'index', 'public', 'deal_activities', 'idx_deal_activities_deal', '', '', true),
    (41, '001_initial_schema.sql', 'index', 'public', 'activities', 'idx_activities_org', '', '', true),
    (42, '001_initial_schema.sql', 'index', 'public', 'activities', 'idx_activities_type', '', '', true),
    (43, '001_initial_schema.sql', 'index', 'public', 'activities', 'idx_activities_status', '', '', true),
    (44, '001_initial_schema.sql', 'index', 'public', 'activities', 'idx_activities_related', '', '', true),
    (45, '001_initial_schema.sql', 'index', 'public', 'calendar_events', 'idx_calendar_org', '', '', true),
    (46, '001_initial_schema.sql', 'index', 'public', 'calendar_events', 'idx_calendar_date', '', '', true),
    (47, '001_initial_schema.sql', 'index', 'public', 'user_integrations', 'idx_integrations_user', '', '', true),
    (48, '001_initial_schema.sql', 'function', 'public', '', 'handle_new_user', '', '', true),
    (49, '001_initial_schema.sql', 'function', 'public', '', 'update_updated_at', '', '', true),
    (50, '001_initial_schema.sql', 'trigger', 'auth', 'users', 'on_auth_user_created', '', '', true),
    (51, '001_initial_schema.sql', 'trigger', 'public', 'organizations', 'set_updated_at', '', '', true),
    (52, '001_initial_schema.sql', 'trigger', 'public', 'profiles', 'set_updated_at', '', '', true),
    (53, '001_initial_schema.sql', 'trigger', 'public', 'customers', 'set_updated_at', '', '', true),
    (54, '001_initial_schema.sql', 'trigger', 'public', 'leads', 'set_updated_at', '', '', true),
    (55, '001_initial_schema.sql', 'trigger', 'public', 'deals', 'set_updated_at', '', '', true),
    (56, '001_initial_schema.sql', 'trigger', 'public', 'activities', 'set_updated_at', '', '', true),
    (57, '001_initial_schema.sql', 'trigger', 'public', 'calendar_events', 'set_updated_at', '', '', true),
    (58, '001_initial_schema.sql', 'trigger', 'public', 'user_integrations', 'set_updated_at', '', '', true),
    (59, '001_initial_schema.sql', 'trigger', 'public', 'customer_notes', 'set_updated_at', '', '', true),
    (60, '001_initial_schema.sql', 'rls', 'public', 'organizations', 'organizations', '', '', true),
    (61, '001_initial_schema.sql', 'rls', 'public', 'profiles', 'profiles', '', '', true),
    (62, '001_initial_schema.sql', 'rls', 'public', 'customers', 'customers', '', '', true),
    (63, '001_initial_schema.sql', 'rls', 'public', 'customer_custom_fields', 'customer_custom_fields', '', '', true),
    (64, '001_initial_schema.sql', 'rls', 'public', 'customer_notes', 'customer_notes', '', '', true),
    (65, '001_initial_schema.sql', 'rls', 'public', 'customer_activities', 'customer_activities', '', '', true),
    (66, '001_initial_schema.sql', 'rls', 'public', 'leads', 'leads', '', '', true),
    (67, '001_initial_schema.sql', 'rls', 'public', 'lead_notes', 'lead_notes', '', '', true),
    (68, '001_initial_schema.sql', 'rls', 'public', 'lead_activities', 'lead_activities', '', '', true),
    (69, '001_initial_schema.sql', 'rls', 'public', 'deals', 'deals', '', '', true),
    (70, '001_initial_schema.sql', 'rls', 'public', 'deal_notes', 'deal_notes', '', '', true),
    (71, '001_initial_schema.sql', 'rls', 'public', 'deal_activities', 'deal_activities', '', '', true),
    (72, '001_initial_schema.sql', 'rls', 'public', 'activities', 'activities', '', '', true),
    (73, '001_initial_schema.sql', 'rls', 'public', 'calendar_events', 'calendar_events', '', '', true),
    (74, '001_initial_schema.sql', 'rls', 'public', 'user_integrations', 'user_integrations', '', '', true),
    (75, '001_initial_schema.sql', 'policy', 'public', 'profiles', 'Users can view own profile', '', '', true),
    (76, '001_initial_schema.sql', 'policy', 'public', 'profiles', 'Users can update own profile', '', '', true),
    (77, '001_initial_schema.sql', 'policy', 'public', 'organizations', 'Org members can view', '', '', true),
    (78, '001_initial_schema.sql', 'policy', 'public', 'organizations', 'Authenticated users can create orgs', '', '', true),
    (79, '001_initial_schema.sql', 'policy', 'public', 'organizations', 'Org members can update', '', '', true),
    (80, '001_initial_schema.sql', 'policy', 'public', 'customers', 'Org members can view customers', '', '', true),
    (81, '001_initial_schema.sql', 'policy', 'public', 'customers', 'Org members can insert customers', '', '', true),
    (82, '001_initial_schema.sql', 'policy', 'public', 'customers', 'Org members can update customers', '', '', true),
    (83, '001_initial_schema.sql', 'policy', 'public', 'customers', 'Org members can delete customers', '', '', true),
    (84, '001_initial_schema.sql', 'policy', 'public', 'customer_custom_fields', 'Access customer custom fields', '', '', true),
    (85, '001_initial_schema.sql', 'policy', 'public', 'customer_notes', 'Access customer notes', '', '', true),
    (86, '001_initial_schema.sql', 'policy', 'public', 'customer_activities', 'Access customer activities', '', '', true),
    (87, '001_initial_schema.sql', 'policy', 'public', 'leads', 'Org members can manage leads', '', '', true),
    (88, '001_initial_schema.sql', 'policy', 'public', 'lead_notes', 'Access lead notes', '', '', true),
    (89, '001_initial_schema.sql', 'policy', 'public', 'lead_activities', 'Access lead activities', '', '', true),
    (90, '001_initial_schema.sql', 'policy', 'public', 'deals', 'Org members can manage deals', '', '', true),
    (91, '001_initial_schema.sql', 'policy', 'public', 'deal_notes', 'Access deal notes', '', '', true),
    (92, '001_initial_schema.sql', 'policy', 'public', 'deal_activities', 'Access deal activities', '', '', true),
    (93, '001_initial_schema.sql', 'policy', 'public', 'activities', 'Org members can manage activities', '', '', true),
    (94, '001_initial_schema.sql', 'policy', 'public', 'calendar_events', 'Org members can manage calendar events', '', '', true),
    (95, '001_initial_schema.sql', 'policy', 'public', 'user_integrations', 'Users manage own integrations', '', '', true),
    (96, '001_initial_schema.sql', 'policy', 'storage', 'objects', 'Anyone can view avatars', '', '', true),
    (97, '001_initial_schema.sql', 'bucket', 'storage', 'buckets', 'avatars', '', '', true),
    (98, '002_fix_org_insert_rls.sql', 'policy_def', 'public', 'organizations', 'Authenticated users can create orgs', '', '%auth.uid()%', true),
    (99, '003_lead_scoring.sql', 'table', 'public', '', 'scoring_profiles', '', '', true),
    (100, '003_lead_scoring.sql', 'table', 'public', '', 'lead_score_history', '', '', true),
    (101, '003_lead_scoring.sql', 'column', 'public', 'leads', 'score_breakdown', '', '', true),
    (102, '003_lead_scoring.sql', 'column', 'public', 'leads', 'last_scored_at', '', '', true),
    (103, '003_lead_scoring.sql', 'column', 'public', 'leads', 'engagement_score', '', '', true),
    (104, '003_lead_scoring.sql', 'index', 'public', 'lead_score_history', 'idx_lead_score_history_lead', '', '', true),
    (105, '003_lead_scoring.sql', 'function', 'public', '', 'update_scoring_profiles_updated_at', '', '', true),
    (106, '003_lead_scoring.sql', 'trigger', 'public', 'scoring_profiles', 'scoring_profiles_updated_at', '', '', true),
    (107, '003_lead_scoring.sql', 'rls', 'public', 'scoring_profiles', 'scoring_profiles', '', '', true),
    (108, '003_lead_scoring.sql', 'rls', 'public', 'lead_score_history', 'lead_score_history', '', '', true),
    (109, '003_lead_scoring.sql', 'policy', 'public', 'scoring_profiles', 'scoring_profiles_org', '', '', true),
    (110, '003_lead_scoring.sql', 'policy', 'public', 'lead_score_history', 'lead_score_history_via_lead', '', '', true),
    (111, '004_icp_profiles.sql', 'table', 'public', '', 'icp_profiles', '', '', true),
    (112, '004_icp_profiles.sql', 'column', 'public', 'leads', 'icp_match_score', '', '', true),
    (113, '004_icp_profiles.sql', 'column', 'public', 'leads', 'icp_profile_id', '', '', true),
    (114, '004_icp_profiles.sql', 'column', 'public', 'leads', 'icp_match_breakdown', '', '', true),
    (115, '004_icp_profiles.sql', 'index', 'public', 'leads', 'idx_leads_icp_profile', '', '', true),
    (116, '004_icp_profiles.sql', 'function', 'public', '', 'update_icp_profiles_updated_at', '', '', true),
    (117, '004_icp_profiles.sql', 'trigger', 'public', 'icp_profiles', 'icp_profiles_updated_at', '', '', true),
    (118, '004_icp_profiles.sql', 'rls', 'public', 'icp_profiles', 'icp_profiles', '', '', true),
    (119, '004_icp_profiles.sql', 'policy', 'public', 'icp_profiles', 'icp_profiles_org', '', '', true),
    (120, '005_qualification.sql', 'column', 'public', 'leads', 'qualification_data', '', '', true),
    (121, '005_qualification.sql', 'column', 'public', 'leads', 'qualification_grade', '', '', true),
    (122, '005_qualification.sql', 'column', 'public', 'leads', 'qualification_score', '', '', true),
    (123, '005_qualification.sql', 'index', 'public', 'leads', 'idx_leads_qualification_grade', '', '', true),
    (124, '006_sequences.sql', 'table', 'public', '', 'sequences', '', '', true),
    (125, '006_sequences.sql', 'table', 'public', '', 'sequence_steps', '', '', true),
    (126, '006_sequences.sql', 'table', 'public', '', 'email_templates', '', '', true),
    (127, '006_sequences.sql', 'table', 'public', '', 'sequence_enrollments', '', '', true),
    (128, '006_sequences.sql', 'table', 'public', '', 'sequence_events', '', '', true),
    (129, '006_sequences.sql', 'index', 'public', 'sequence_steps', 'idx_sequence_steps_sequence', '', '', true),
    (130, '006_sequences.sql', 'index', 'public', 'sequence_enrollments', 'idx_sequence_enrollments_lead', '', '', true),
    (131, '006_sequences.sql', 'index', 'public', 'sequence_enrollments', 'idx_sequence_enrollments_sequence', '', '', true),
    (132, '006_sequences.sql', 'index', 'public', 'sequence_events', 'idx_sequence_events_enrollment', '', '', true),
    (133, '006_sequences.sql', 'function', 'public', '', 'update_sequences_updated_at', '', '', true),
    (134, '006_sequences.sql', 'trigger', 'public', 'sequences', 'sequences_updated_at', '', '', true),
    (135, '006_sequences.sql', 'trigger', 'public', 'sequence_steps', 'sequence_steps_updated_at', '', '', true),
    (136, '006_sequences.sql', 'trigger', 'public', 'email_templates', 'email_templates_updated_at', '', '', true),
    (137, '006_sequences.sql', 'trigger', 'public', 'sequence_enrollments', 'sequence_enrollments_updated_at', '', '', true),
    (138, '006_sequences.sql', 'rls', 'public', 'sequences', 'sequences', '', '', true),
    (139, '006_sequences.sql', 'rls', 'public', 'sequence_steps', 'sequence_steps', '', '', true),
    (140, '006_sequences.sql', 'rls', 'public', 'email_templates', 'email_templates', '', '', true),
    (141, '006_sequences.sql', 'rls', 'public', 'sequence_enrollments', 'sequence_enrollments', '', '', true),
    (142, '006_sequences.sql', 'rls', 'public', 'sequence_events', 'sequence_events', '', '', true),
    (143, '006_sequences.sql', 'policy', 'public', 'sequences', 'sequences_org', '', '', true),
    (144, '006_sequences.sql', 'policy', 'public', 'sequence_steps', 'sequence_steps_via_sequence', '', '', true),
    (145, '006_sequences.sql', 'policy', 'public', 'email_templates', 'email_templates_org', '', '', true),
    (146, '006_sequences.sql', 'policy', 'public', 'sequence_enrollments', 'sequence_enrollments_via_sequence', '', '', true),
    (147, '006_sequences.sql', 'policy', 'public', 'sequence_events', 'sequence_events_via_enrollment', '', '', true),
    (148, '007_competitive_intel.sql', 'table', 'public', '', 'competitors', '', '', true),
    (149, '007_competitive_intel.sql', 'table', 'public', '', 'battle_cards', '', '', true),
    (150, '007_competitive_intel.sql', 'table', 'public', '', 'lead_competitors', '', '', true),
    (151, '007_competitive_intel.sql', 'index', 'public', 'lead_competitors', 'idx_lead_competitors_lead', '', '', true),
    (152, '007_competitive_intel.sql', 'index', 'public', 'lead_competitors', 'idx_lead_competitors_competitor', '', '', true),
    (153, '007_competitive_intel.sql', 'trigger', 'public', 'competitors', 'competitors_updated_at', '', '', true),
    (154, '007_competitive_intel.sql', 'trigger', 'public', 'battle_cards', 'battle_cards_updated_at', '', '', true),
    (155, '007_competitive_intel.sql', 'rls', 'public', 'competitors', 'competitors', '', '', true),
    (156, '007_competitive_intel.sql', 'rls', 'public', 'battle_cards', 'battle_cards', '', '', true),
    (157, '007_competitive_intel.sql', 'rls', 'public', 'lead_competitors', 'lead_competitors', '', '', true),
    (158, '007_competitive_intel.sql', 'policy', 'public', 'competitors', 'competitors_org', '', '', true),
    (159, '007_competitive_intel.sql', 'policy', 'public', 'battle_cards', 'battle_cards_via_competitor', '', '', true),
    (160, '007_competitive_intel.sql', 'policy', 'public', 'lead_competitors', 'lead_competitors_via_lead', '', '', true),
    (161, '008_objections.sql', 'table', 'public', '', 'objection_playbook', '', '', true),
    (162, '008_objections.sql', 'index', 'public', 'objection_playbook', 'idx_objection_playbook_org', '', '', true),
    (163, '008_objections.sql', 'index', 'public', 'objection_playbook', 'idx_objection_playbook_category', '', '', true),
    (164, '008_objections.sql', 'trigger', 'public', 'objection_playbook', 'set_objection_playbook_updated_at', '', '', true),
    (165, '008_objections.sql', 'rls', 'public', 'objection_playbook', 'objection_playbook', '', '', true),
    (166, '008_objections.sql', 'policy', 'public', 'objection_playbook', 'objection_playbook_org', '', '', true),
    (167, '009_proposals.sql', 'table', 'public', '', 'proposals', '', '', true),
    (168, '009_proposals.sql', 'index', 'public', 'proposals', 'idx_proposals_org', '', '', true),
    (169, '009_proposals.sql', 'index', 'public', 'proposals', 'idx_proposals_deal', '', '', true),
    (170, '009_proposals.sql', 'index', 'public', 'proposals', 'idx_proposals_status', '', '', true),
    (171, '009_proposals.sql', 'trigger', 'public', 'proposals', 'set_proposals_updated_at', '', '', true),
    (172, '009_proposals.sql', 'rls', 'public', 'proposals', 'proposals', '', '', true),
    (173, '009_proposals.sql', 'policy', 'public', 'proposals', 'proposals_org', '', '', true),
    (174, '010_phase15_features.sql', 'table', 'public', '', 'contacts', '', '', true),
    (175, '010_phase15_features.sql', 'table', 'public', '', 'copy_templates', '', '', true),
    (176, '010_phase15_features.sql', 'column', 'public', 'leads', 'next_followup', '', '', true),
    (177, '010_phase15_features.sql', 'column', 'public', 'leads', 'followup_note', '', '', true),
    (178, '010_phase15_features.sql', 'index', 'public', 'contacts', 'idx_contacts_org', '', '', true),
    (179, '010_phase15_features.sql', 'index', 'public', 'contacts', 'idx_contacts_lead', '', '', true),
    (180, '010_phase15_features.sql', 'index', 'public', 'contacts', 'idx_contacts_customer', '', '', true),
    (181, '010_phase15_features.sql', 'index', 'public', 'contacts', 'idx_contacts_role', '', '', true),
    (182, '010_phase15_features.sql', 'index', 'public', 'copy_templates', 'idx_copy_templates_org', '', '', true),
    (183, '010_phase15_features.sql', 'index', 'public', 'copy_templates', 'idx_copy_templates_category', '', '', true),
    (184, '010_phase15_features.sql', 'trigger', 'public', 'contacts', 'set_contacts_updated_at', '', '', true),
    (185, '010_phase15_features.sql', 'trigger', 'public', 'copy_templates', 'set_copy_templates_updated_at', '', '', true),
    (186, '010_phase15_features.sql', 'rls', 'public', 'contacts', 'contacts', '', '', true),
    (187, '010_phase15_features.sql', 'rls', 'public', 'copy_templates', 'copy_templates', '', '', true),
    (188, '010_phase15_features.sql', 'policy', 'public', 'contacts', 'contacts_org', '', '', true),
    (189, '010_phase15_features.sql', 'policy', 'public', 'copy_templates', 'copy_templates_org', '', '', true),
    (190, '011_ai_foundation.sql', 'table', 'public', '', 'ai_settings', '', '', true),
    (191, '011_ai_foundation.sql', 'table', 'public', '', 'ai_usage_log', '', '', true),
    (192, '011_ai_foundation.sql', 'index', 'public', 'ai_usage_log', 'idx_ai_usage_log_org_created', '', '', true),
    (193, '011_ai_foundation.sql', 'index', 'public', 'ai_usage_log', 'idx_ai_usage_log_user_created', '', '', true),
    (194, '011_ai_foundation.sql', 'index', 'public', 'ai_usage_log', 'idx_ai_usage_log_feature', '', '', true),
    (195, '011_ai_foundation.sql', 'trigger', 'public', 'ai_settings', 'ai_settings_updated_at', '', '', true),
    (196, '011_ai_foundation.sql', 'rls', 'public', 'ai_settings', 'ai_settings', '', '', true),
    (197, '011_ai_foundation.sql', 'rls', 'public', 'ai_usage_log', 'ai_usage_log', '', '', true),
    (198, '011_ai_foundation.sql', 'policy', 'public', 'ai_settings', 'Users can view their org AI settings', '', '', true),
    (199, '011_ai_foundation.sql', 'policy', 'public', 'ai_settings', 'Users can insert their org AI settings', '', '', true),
    (200, '011_ai_foundation.sql', 'policy', 'public', 'ai_settings', 'Users can update their org AI settings', '', '', true),
    (201, '011_ai_foundation.sql', 'policy', 'public', 'ai_usage_log', 'Users can view their org usage logs', '', '', true),
    (202, '011_ai_foundation.sql', 'policy', 'public', 'ai_usage_log', 'Users can insert usage logs', '', '', true),
    (203, '011_ai_foundation.sql', 'policy', 'public', 'ai_settings', 'Service role full access to ai_settings', '', '', true),
    (204, '011_ai_foundation.sql', 'policy', 'public', 'ai_usage_log', 'Service role full access to ai_usage_log', '', '', true),
    (205, '016_email_system.sql', 'enum', 'public', '', 'email_provider', '', '', true),
    (206, '016_email_system.sql', 'enum', 'public', '', 'email_account_status', '', '', true),
    (207, '016_email_system.sql', 'enum', 'public', '', 'email_direction', '', '', true),
    (208, '016_email_system.sql', 'enum', 'public', '', 'email_message_status', '', '', true),
    (209, '016_email_system.sql', 'enum', 'public', '', 'tracking_event_type', '', '', true),
    (210, '016_email_system.sql', 'table', 'public', '', 'email_accounts', '', '', true),
    (211, '016_email_system.sql', 'table', 'public', '', 'email_threads', '', '', true),
    (212, '016_email_system.sql', 'table', 'public', '', 'email_messages', '', '', true),
    (213, '016_email_system.sql', 'table', 'public', '', 'email_tracking_events', '', '', true),
    (214, '016_email_system.sql', 'table', 'public', '', 'email_link_tracking', '', '', true),
    (215, '016_email_system.sql', 'index', 'public', 'email_accounts', 'idx_email_accounts_org', '', '', true),
    (216, '016_email_system.sql', 'index', 'public', 'email_accounts', 'idx_email_accounts_user', '', '', true),
    (217, '016_email_system.sql', 'index', 'public', 'email_threads', 'idx_email_threads_org', '', '', true),
    (218, '016_email_system.sql', 'index', 'public', 'email_threads', 'idx_email_threads_account', '', '', true),
    (219, '016_email_system.sql', 'index', 'public', 'email_threads', 'idx_email_threads_lead', '', '', true),
    (220, '016_email_system.sql', 'index', 'public', 'email_threads', 'idx_email_threads_last_msg', '', '', true),
    (221, '016_email_system.sql', 'index', 'public', 'email_messages', 'idx_email_messages_thread', '', '', true),
    (222, '016_email_system.sql', 'index', 'public', 'email_messages', 'idx_email_messages_account', '', '', true),
    (223, '016_email_system.sql', 'index', 'public', 'email_messages', 'idx_email_messages_tracking', '', '', true),
    (224, '016_email_system.sql', 'index', 'public', 'email_messages', 'idx_email_messages_status', '', '', true),
    (225, '016_email_system.sql', 'index', 'public', 'email_messages', 'idx_email_messages_scheduled', '', '', true),
    (226, '016_email_system.sql', 'index', 'public', 'email_messages', 'idx_email_messages_sent', '', '', true),
    (227, '016_email_system.sql', 'index', 'public', 'email_tracking_events', 'idx_tracking_events_message', '', '', true),
    (228, '016_email_system.sql', 'index', 'public', 'email_tracking_events', 'idx_tracking_events_type', '', '', true),
    (229, '016_email_system.sql', 'index', 'public', 'email_tracking_events', 'idx_tracking_events_created', '', '', true),
    (230, '016_email_system.sql', 'index', 'public', 'email_link_tracking', 'idx_link_tracking_message', '', '', true),
    (231, '016_email_system.sql', 'trigger', 'public', 'email_accounts', 'trg_email_accounts_updated_at', '', '', true),
    (232, '016_email_system.sql', 'trigger', 'public', 'email_threads', 'trg_email_threads_updated_at', '', '', true),
    (233, '016_email_system.sql', 'trigger', 'public', 'email_messages', 'trg_email_messages_updated_at', '', '', true),
    (234, '016_email_system.sql', 'rls', 'public', 'email_accounts', 'email_accounts', '', '', true),
    (235, '016_email_system.sql', 'rls', 'public', 'email_threads', 'email_threads', '', '', true),
    (236, '016_email_system.sql', 'rls', 'public', 'email_messages', 'email_messages', '', '', true),
    (237, '016_email_system.sql', 'rls', 'public', 'email_tracking_events', 'email_tracking_events', '', '', true),
    (238, '016_email_system.sql', 'rls', 'public', 'email_link_tracking', 'email_link_tracking', '', '', true),
    (239, '016_email_system.sql', 'policy', 'public', 'email_threads', 'org_email_threads', '', '', true),
    (240, '016_email_system.sql', 'policy', 'public', 'email_messages', 'org_email_messages', '', '', true),
    (241, '016_email_system.sql', 'policy', 'public', 'email_tracking_events', 'org_email_tracking_events', '', '', true),
    (242, '016_email_system.sql', 'policy', 'public', 'email_link_tracking', 'org_email_link_tracking', '', '', true),
    (243, '017_email_rpc_functions.sql', 'function', 'public', '', 'increment_daily_sent_count', 'uuid', '', true),
    (244, '017_email_rpc_functions.sql', 'function', 'public', '', 'increment_message_open_count', 'uuid', '', true),
    (245, '017_email_rpc_functions.sql', 'function', 'public', '', 'increment_message_click_count', 'uuid', '', true),
    (246, '017_email_rpc_functions.sql', 'function', 'public', '', 'increment_link_click_count', 'uuid', '', true),
    (247, '017_email_rpc_functions.sql', 'function', 'public', '', 'reset_daily_sent_counts', '', '', true),
    (248, '020_marketing_suite.sql', 'table', 'public', '', 'marketing_audits', '', '', true),
    (249, '020_marketing_suite.sql', 'table', 'public', '', 'marketing_content', '', '', true),
    (250, '020_marketing_suite.sql', 'table', 'public', '', 'marketing_reports', '', '', true),
    (251, '020_marketing_suite.sql', 'table', 'public', '', 'marketing_action_items', '', '', true),
    (252, '020_marketing_suite.sql', 'column', 'public', 'ai_settings', 'feature_marketing', '', '', true),
    (253, '020_marketing_suite.sql', 'index', 'public', 'marketing_audits', 'idx_marketing_audits_org', '', '', true),
    (254, '020_marketing_suite.sql', 'index', 'public', 'marketing_audits', 'idx_marketing_audits_status', '', '', true),
    (255, '020_marketing_suite.sql', 'index', 'public', 'marketing_audits', 'idx_marketing_audits_customer', '', '', true),
    (256, '020_marketing_suite.sql', 'index', 'public', 'marketing_audits', 'idx_marketing_audits_type', '', '', true),
    (257, '020_marketing_suite.sql', 'index', 'public', 'marketing_content', 'idx_marketing_content_org', '', '', true),
    (258, '020_marketing_suite.sql', 'index', 'public', 'marketing_content', 'idx_marketing_content_audit', '', '', true),
    (259, '020_marketing_suite.sql', 'index', 'public', 'marketing_content', 'idx_marketing_content_type', '', '', true),
    (260, '020_marketing_suite.sql', 'index', 'public', 'marketing_reports', 'idx_marketing_reports_org', '', '', true),
    (261, '020_marketing_suite.sql', 'index', 'public', 'marketing_reports', 'idx_marketing_reports_audit', '', '', true),
    (262, '020_marketing_suite.sql', 'index', 'public', 'marketing_action_items', 'idx_marketing_action_items_org', '', '', true),
    (263, '020_marketing_suite.sql', 'index', 'public', 'marketing_action_items', 'idx_marketing_action_items_audit', '', '', true),
    (264, '020_marketing_suite.sql', 'index', 'public', 'marketing_action_items', 'idx_marketing_action_items_status', '', '', true),
    (265, '020_marketing_suite.sql', 'trigger', 'public', 'marketing_audits', 'set_marketing_audits_updated_at', '', '', true),
    (266, '020_marketing_suite.sql', 'trigger', 'public', 'marketing_content', 'set_marketing_content_updated_at', '', '', true),
    (267, '020_marketing_suite.sql', 'trigger', 'public', 'marketing_reports', 'set_marketing_reports_updated_at', '', '', true),
    (268, '020_marketing_suite.sql', 'trigger', 'public', 'marketing_action_items', 'set_marketing_action_items_updated_at', '', '', true),
    (269, '020_marketing_suite.sql', 'rls', 'public', 'marketing_audits', 'marketing_audits', '', '', true),
    (270, '020_marketing_suite.sql', 'rls', 'public', 'marketing_content', 'marketing_content', '', '', true),
    (271, '020_marketing_suite.sql', 'rls', 'public', 'marketing_reports', 'marketing_reports', '', '', true),
    (272, '020_marketing_suite.sql', 'rls', 'public', 'marketing_action_items', 'marketing_action_items', '', '', true),
    (273, '020_marketing_suite.sql', 'policy', 'public', 'marketing_audits', 'marketing_audits_org', '', '', true),
    (274, '020_marketing_suite.sql', 'policy', 'public', 'marketing_content', 'marketing_content_org', '', '', true),
    (275, '020_marketing_suite.sql', 'policy', 'public', 'marketing_reports', 'marketing_reports_org', '', '', true),
    (276, '020_marketing_suite.sql', 'policy', 'public', 'marketing_action_items', 'marketing_action_items_org', '', '', true),
    (277, '025_lead_finder.sql', 'table', 'public', '', 'lf_campaigns', '', '', true),
    (278, '025_lead_finder.sql', 'table', 'public', '', 'lf_leads', '', '', true),
    (279, '025_lead_finder.sql', 'table', 'public', '', 'lf_lead_personalization', '', '', true),
    (280, '025_lead_finder.sql', 'table', 'public', '', 'lf_apify_runs', '', '', true),
    (281, '025_lead_finder.sql', 'table', 'public', '', 'lf_custom_actors', '', '', true),
    (282, '025_lead_finder.sql', 'table', 'public', '', 'lf_llm_costs', '', '', true),
    (283, '025_lead_finder.sql', 'table', 'public', '', 'lf_analytics_events', '', '', true),
    (284, '025_lead_finder.sql', 'column', 'public', 'ai_settings', 'openai_api_key', '', '', true),
    (285, '025_lead_finder.sql', 'index', 'public', 'lf_campaigns', 'idx_lf_campaigns_org', '', '', true),
    (286, '025_lead_finder.sql', 'index', 'public', 'lf_leads', 'idx_lf_leads_org', '', '', true),
    (287, '025_lead_finder.sql', 'index', 'public', 'lf_leads', 'idx_lf_leads_campaign', '', '', true),
    (288, '025_lead_finder.sql', 'index', 'public', 'lf_leads', 'idx_lf_leads_email', '', '', true),
    (289, '025_lead_finder.sql', 'index', 'public', 'lf_leads', 'idx_lf_leads_website', '', '', true),
    (290, '025_lead_finder.sql', 'index', 'public', 'lf_leads', 'idx_lf_leads_status', '', '', true),
    (291, '025_lead_finder.sql', 'index', 'public', 'lf_leads', 'idx_lf_leads_imported', '', '', true),
    (292, '025_lead_finder.sql', 'index', 'public', 'lf_lead_personalization', 'idx_lf_lead_personalization_lead', '', '', true),
    (293, '025_lead_finder.sql', 'index', 'public', 'lf_apify_runs', 'idx_lf_apify_runs_org', '', '', true),
    (294, '025_lead_finder.sql', 'index', 'public', 'lf_apify_runs', 'idx_lf_apify_runs_campaign', '', '', true),
    (295, '025_lead_finder.sql', 'index', 'public', 'lf_apify_runs', 'idx_lf_apify_runs_run_id', '', '', true),
    (296, '025_lead_finder.sql', 'index', 'public', 'lf_custom_actors', 'idx_lf_custom_actors_org', '', '', true),
    (297, '025_lead_finder.sql', 'index', 'public', 'lf_llm_costs', 'idx_lf_llm_costs_org', '', '', true),
    (298, '025_lead_finder.sql', 'index', 'public', 'lf_llm_costs', 'idx_lf_llm_costs_campaign', '', '', true),
    (299, '025_lead_finder.sql', 'index', 'public', 'lf_analytics_events', 'idx_lf_analytics_org', '', '', true),
    (300, '025_lead_finder.sql', 'index', 'public', 'lf_analytics_events', 'idx_lf_analytics_campaign', '', '', true),
    (301, '025_lead_finder.sql', 'trigger', 'public', 'lf_campaigns', 'set_lf_campaigns_updated_at', '', '', true),
    (302, '025_lead_finder.sql', 'trigger', 'public', 'lf_leads', 'set_lf_leads_updated_at', '', '', true),
    (303, '025_lead_finder.sql', 'trigger', 'public', 'lf_custom_actors', 'set_lf_custom_actors_updated_at', '', '', true),
    (304, '025_lead_finder.sql', 'rls', 'public', 'lf_campaigns', 'lf_campaigns', '', '', true),
    (305, '025_lead_finder.sql', 'rls', 'public', 'lf_leads', 'lf_leads', '', '', true),
    (306, '025_lead_finder.sql', 'rls', 'public', 'lf_lead_personalization', 'lf_lead_personalization', '', '', true),
    (307, '025_lead_finder.sql', 'rls', 'public', 'lf_apify_runs', 'lf_apify_runs', '', '', true),
    (308, '025_lead_finder.sql', 'rls', 'public', 'lf_custom_actors', 'lf_custom_actors', '', '', true),
    (309, '025_lead_finder.sql', 'rls', 'public', 'lf_llm_costs', 'lf_llm_costs', '', '', true),
    (310, '025_lead_finder.sql', 'rls', 'public', 'lf_analytics_events', 'lf_analytics_events', '', '', true),
    (311, '025_lead_finder.sql', 'policy', 'public', 'lf_campaigns', 'Users can view own org campaigns', '', '', true),
    (312, '025_lead_finder.sql', 'policy', 'public', 'lf_campaigns', 'Users can insert own org campaigns', '', '', true),
    (313, '025_lead_finder.sql', 'policy', 'public', 'lf_campaigns', 'Users can update own org campaigns', '', '', true),
    (314, '025_lead_finder.sql', 'policy', 'public', 'lf_campaigns', 'Users can delete own org campaigns', '', '', true),
    (315, '025_lead_finder.sql', 'policy', 'public', 'lf_leads', 'Users can view own org lf_leads', '', '', true),
    (316, '025_lead_finder.sql', 'policy', 'public', 'lf_leads', 'Users can insert own org lf_leads', '', '', true),
    (317, '025_lead_finder.sql', 'policy', 'public', 'lf_leads', 'Users can update own org lf_leads', '', '', true),
    (318, '025_lead_finder.sql', 'policy', 'public', 'lf_leads', 'Users can delete own org lf_leads', '', '', true),
    (319, '025_lead_finder.sql', 'policy', 'public', 'lf_lead_personalization', 'Users can view own org lf_personalization', '', '', true),
    (320, '025_lead_finder.sql', 'policy', 'public', 'lf_lead_personalization', 'Users can insert own org lf_personalization', '', '', true),
    (321, '025_lead_finder.sql', 'policy', 'public', 'lf_lead_personalization', 'Users can update own org lf_personalization', '', '', true),
    (322, '025_lead_finder.sql', 'policy', 'public', 'lf_lead_personalization', 'Users can delete own org lf_personalization', '', '', true),
    (323, '025_lead_finder.sql', 'policy', 'public', 'lf_apify_runs', 'Users can view own org lf_apify_runs', '', '', true),
    (324, '025_lead_finder.sql', 'policy', 'public', 'lf_apify_runs', 'Users can insert own org lf_apify_runs', '', '', true),
    (325, '025_lead_finder.sql', 'policy', 'public', 'lf_apify_runs', 'Users can update own org lf_apify_runs', '', '', true),
    (326, '025_lead_finder.sql', 'policy', 'public', 'lf_custom_actors', 'Users can view own org lf_custom_actors', '', '', true),
    (327, '025_lead_finder.sql', 'policy', 'public', 'lf_custom_actors', 'Users can insert own org lf_custom_actors', '', '', true),
    (328, '025_lead_finder.sql', 'policy', 'public', 'lf_custom_actors', 'Users can update own org lf_custom_actors', '', '', true),
    (329, '025_lead_finder.sql', 'policy', 'public', 'lf_custom_actors', 'Users can delete own org lf_custom_actors', '', '', true),
    (330, '025_lead_finder.sql', 'policy', 'public', 'lf_llm_costs', 'Users can view own org lf_llm_costs', '', '', true),
    (331, '025_lead_finder.sql', 'policy', 'public', 'lf_llm_costs', 'Users can insert own org lf_llm_costs', '', '', true),
    (332, '025_lead_finder.sql', 'policy', 'public', 'lf_analytics_events', 'Users can view own org lf_analytics_events', '', '', true),
    (333, '025_lead_finder.sql', 'policy', 'public', 'lf_analytics_events', 'Users can insert own org lf_analytics_events', '', '', true),
    (334, '026_lead_finder_settings.sql', 'column', 'public', 'organizations', 'agency_type', '', '', true),
    (335, '026_lead_finder_settings.sql', 'column', 'public', 'organizations', 'agency_description', '', '', true),
    (336, '026_lead_finder_settings.sql', 'column', 'public', 'organizations', 'services', '', '', true),
    (337, '026_lead_finder_settings.sql', 'column', 'public', 'organizations', 'results_case_studies', '', '', true),
    (338, '026_lead_finder_settings.sql', 'column', 'public', 'organizations', 'target_industries', '', '', true),
    (339, '026_lead_finder_settings.sql', 'column', 'public', 'organizations', 'agency_website', '', '', true),
    (340, '026_lead_finder_settings.sql', 'column', 'public', 'ai_settings', 'parallel_enrichment_limit', '', '', true),
    (341, '027_lead_finder_parity.sql', 'table', 'public', '', 'lf_enrichment_batches', '', '', true),
    (342, '027_lead_finder_parity.sql', 'table', 'public', '', 'lf_enrichment_jobs', '', '', true),
    (343, '027_lead_finder_parity.sql', 'table', 'public', '', 'lf_obsidian_sync_state', '', '', true),
    (344, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'apify_api_key', '', '', true),
    (345, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'openrouter_api_key', '', '', true),
    (346, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'openrouter_oauth_token', '', '', true),
    (347, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'openrouter_code_verifier', '', '', true),
    (348, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'openrouter_expires_at', '', '', true),
    (349, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'groq_api_key', '', '', true),
    (350, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'ollama_base_url', '', '', true),
    (351, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'ai_provider', '', '', true),
    (352, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'obsidian_vault_path', '', '', true),
    (353, '027_lead_finder_parity.sql', 'column', 'public', 'ai_settings', 'obsidian_sync_enabled', '', '', true),
    (354, '027_lead_finder_parity.sql', 'column', 'public', 'lf_campaigns', 'search_params', '', '', true),
    (355, '027_lead_finder_parity.sql', 'column', 'public', 'lf_campaigns', 'agency_type', '', '', true),
    (356, '027_lead_finder_parity.sql', 'column', 'public', 'lf_campaigns', 'obsidian_sync_enabled', '', '', true),
    (357, '027_lead_finder_parity.sql', 'column', 'public', 'lf_leads', 'last_enrich_error', '', '', true),
    (358, '027_lead_finder_parity.sql', 'column', 'public', 'lf_leads', 'last_enrich_attempt_at', '', '', true),
    (359, '027_lead_finder_parity.sql', 'column', 'public', 'lf_leads', 'enrich_attempts', '', '', true),
    (360, '027_lead_finder_parity.sql', 'constraint_def', 'public', 'ai_settings', 'ai_settings_ai_provider_check', '', '%openrouter%', true),
    (361, '027_lead_finder_parity.sql', 'constraint_def', 'public', 'lf_campaigns', 'lf_campaigns_ai_provider_check', '', '%openrouter%', true),
    (362, '027_lead_finder_parity.sql', 'constraint_def', 'public', 'lf_llm_costs', 'lf_llm_costs_provider_check', '', '%openrouter%', true),
    (363, '027_lead_finder_parity.sql', 'index', 'public', 'lf_enrichment_jobs', 'idx_lf_enrichment_jobs_runnable', '', '', true),
    (364, '027_lead_finder_parity.sql', 'index', 'public', 'lf_enrichment_jobs', 'idx_lf_enrichment_jobs_status_next_attempt', '', '', true),
    (365, '027_lead_finder_parity.sql', 'index', 'public', 'lf_enrichment_jobs', 'idx_lf_enrichment_jobs_batch', '', '', true),
    (366, '027_lead_finder_parity.sql', 'index', 'public', 'lf_enrichment_jobs', 'idx_lf_enrichment_jobs_lead', '', '', true),
    (367, '027_lead_finder_parity.sql', 'index', 'public', 'lf_enrichment_jobs', 'idx_lf_enrichment_jobs_org', '', '', true),
    (368, '027_lead_finder_parity.sql', 'index', 'public', 'lf_enrichment_batches', 'idx_lf_enrichment_batches_org', '', '', true),
    (369, '027_lead_finder_parity.sql', 'index', 'public', 'lf_enrichment_batches', 'idx_lf_enrichment_batches_campaign', '', '', true),
    (370, '027_lead_finder_parity.sql', 'index', 'public', 'lf_leads', 'idx_lf_leads_org_status', '', '', true),
    (371, '027_lead_finder_parity.sql', 'index', 'public', 'lf_leads', 'idx_lf_leads_campaign_status', '', '', true),
    (372, '027_lead_finder_parity.sql', 'rls', 'public', 'lf_enrichment_batches', 'lf_enrichment_batches', '', '', true),
    (373, '027_lead_finder_parity.sql', 'rls', 'public', 'lf_enrichment_jobs', 'lf_enrichment_jobs', '', '', true),
    (374, '027_lead_finder_parity.sql', 'rls', 'public', 'lf_obsidian_sync_state', 'lf_obsidian_sync_state', '', '', true),
    (375, '027_lead_finder_parity.sql', 'policy', 'public', 'lf_enrichment_batches', 'org can read lf_enrichment_batches', '', '', true),
    (376, '027_lead_finder_parity.sql', 'policy', 'public', 'lf_enrichment_batches', 'org can write lf_enrichment_batches', '', '', true),
    (377, '027_lead_finder_parity.sql', 'policy', 'public', 'lf_enrichment_jobs', 'org can read lf_enrichment_jobs', '', '', true),
    (378, '027_lead_finder_parity.sql', 'policy', 'public', 'lf_enrichment_jobs', 'org can write lf_enrichment_jobs', '', '', true),
    (379, '027_lead_finder_parity.sql', 'policy', 'public', 'lf_obsidian_sync_state', 'org can read lf_obsidian_sync_state', '', '', true),
    (380, '027_lead_finder_parity.sql', 'policy', 'public', 'lf_obsidian_sync_state', 'org can write lf_obsidian_sync_state', '', '', true),
    (381, '022_automation_rules.sql', 'table', 'public', '', 'automation_rules', '', '', true),
    (382, '022_automation_rules.sql', 'table', 'public', '', 'automation_executions', '', '', true),
    (383, '022_automation_rules.sql', 'table', 'public', '', 'custom_fields', '', '', true),
    (384, '022_automation_rules.sql', 'table', 'public', '', 'lead_custom_field_values', '', '', true),
    (385, '022_automation_rules.sql', 'table', 'public', '', 'campaign_runs', '', '', true),
    (386, '022_automation_rules.sql', 'table', 'public', '', 'campaign_leads', '', '', true),
    (387, '022_automation_rules.sql', 'column', 'public', 'leads', 'assigned_to', '', '', true),
    (388, '022_automation_rules.sql', 'column', 'public', 'leads', 'status_changed_at', '', '', true),
    (389, '022_automation_rules.sql', 'column', 'public', 'leads', 'last_engagement_at', '', '', true),
    (390, '022_automation_rules.sql', 'column', 'public', 'lead_searches', 'is_recurring', '', '', true),
    (391, '022_automation_rules.sql', 'column', 'public', 'lead_searches', 'schedule_frequency', '', '', true),
    (392, '022_automation_rules.sql', 'column', 'public', 'lead_searches', 'last_run_at', '', '', true),
    (393, '022_automation_rules.sql', 'column', 'public', 'lead_searches', 'next_run_at', '', '', true),
    (394, '022_automation_rules.sql', 'column', 'public', 'lead_searches', 'auto_import', '', '', true),
    (395, '022_automation_rules.sql', 'column', 'public', 'lead_searches', 'auto_enroll_sequence_id', '', '', true),
    (396, '022_automation_rules.sql', 'column', 'public', 'scraped_leads', 'verification_status', '', '', true),
    (397, '022_automation_rules.sql', 'column', 'public', 'scraped_leads', 'verified_at', '', '', true),
    (398, '022_automation_rules.sql', 'column', 'public', 'scraped_leads', 'duplicate_of', '', '', true),
    (399, '022_automation_rules.sql', 'column', 'public', 'scraped_leads', 'confidence_score', '', '', true),
    (400, '022_automation_rules.sql', 'column', 'public', 'organizations', 'booking_url', '', '', true),
    (401, '022_automation_rules.sql', 'column', 'public', 'organizations', 'booking_provider', '', '', true),
    (402, '022_automation_rules.sql', 'column', 'public', 'sequence_enrollments', 'campaign_id', '', '', true),
    (403, '022_automation_rules.sql', 'column', 'public', 'sequence_steps', 'include_booking_cta', '', '', true),
    (404, '022_automation_rules.sql', 'index', 'public', 'automation_rules', 'idx_automation_rules_org', '', '', true),
    (405, '022_automation_rules.sql', 'index', 'public', 'automation_rules', 'idx_automation_rules_trigger', '', '', true),
    (406, '022_automation_rules.sql', 'index', 'public', 'automation_executions', 'idx_automation_executions_rule', '', '', true),
    (407, '022_automation_rules.sql', 'index', 'public', 'automation_executions', 'idx_automation_executions_lead', '', '', true),
    (408, '022_automation_rules.sql', 'index', 'public', 'automation_executions', 'idx_automation_executions_created', '', '', true),
    (409, '022_automation_rules.sql', 'index', 'public', 'campaign_leads', 'idx_campaign_leads_campaign', '', '', true),
    (410, '022_automation_rules.sql', 'index', 'public', 'campaign_leads', 'idx_campaign_leads_lead', '', '', true),
    (411, '022_automation_rules.sql', 'function', 'public', '', 'increment_automation_rule_count', 'uuid', '', true),
    (412, '022_automation_rules.sql', 'trigger', 'public', 'automation_rules', 'update_automation_rules_updated_at', '', '', true),
    (413, '022_automation_rules.sql', 'trigger', 'public', 'campaign_runs', 'update_campaign_runs_updated_at', '', '', true),
    (414, '022_automation_rules.sql', 'rls', 'public', 'automation_rules', 'automation_rules', '', '', true),
    (415, '022_automation_rules.sql', 'rls', 'public', 'custom_fields', 'custom_fields', '', '', true),
    (416, '022_automation_rules.sql', 'rls', 'public', 'lead_custom_field_values', 'lead_custom_field_values', '', '', true),
    (417, '022_automation_rules.sql', 'rls', 'public', 'campaign_runs', 'campaign_runs', '', '', true),
    (418, '022_automation_rules.sql', 'policy', 'public', 'automation_rules', 'automation_rules_org_isolation', '', '', true),
    (419, '022_automation_rules.sql', 'policy', 'public', 'custom_fields', 'custom_fields_org_isolation', '', '', true),
    (420, '022_automation_rules.sql', 'policy', 'public', 'lead_custom_field_values', 'lead_custom_field_values_isolation', '', '', true),
    (421, '022_automation_rules.sql', 'policy', 'public', 'campaign_runs', 'campaign_runs_org_isolation', '', '', true),
    (422, '023_multichannel.sql', 'table', 'public', '', 'whatsapp_accounts', '', '', true),
    (423, '023_multichannel.sql', 'table', 'public', '', 'whatsapp_templates', '', '', true),
    (424, '023_multichannel.sql', 'table', 'public', '', 'whatsapp_messages', '', '', true),
    (425, '023_multichannel.sql', 'table', 'public', '', 'linkedin_accounts', '', '', true),
    (426, '023_multichannel.sql', 'table', 'public', '', 'linkedin_actions', '', '', true),
    (427, '023_multichannel.sql', 'column', 'public', 'sequence_steps', 'channel_config', '', '', true),
    (428, '023_multichannel.sql', 'column', 'public', 'sequence_enrollments', 'whatsapp_account_id', '', '', true),
    (429, '023_multichannel.sql', 'column', 'public', 'sequence_enrollments', 'linkedin_account_id', '', '', true),
    (430, '023_multichannel.sql', 'index', 'public', 'whatsapp_accounts', 'idx_whatsapp_accounts_org', '', '', true),
    (431, '023_multichannel.sql', 'index', 'public', 'whatsapp_templates', 'idx_whatsapp_templates_account', '', '', true),
    (432, '023_multichannel.sql', 'index', 'public', 'whatsapp_messages', 'idx_wa_messages_lead', '', '', true),
    (433, '023_multichannel.sql', 'index', 'public', 'whatsapp_messages', 'idx_wa_messages_enrollment', '', '', true),
    (434, '023_multichannel.sql', 'index', 'public', 'whatsapp_messages', 'idx_wa_messages_status', '', '', true),
    (435, '023_multichannel.sql', 'index', 'public', 'whatsapp_messages', 'idx_wa_messages_wa_id', '', '', true),
    (436, '023_multichannel.sql', 'index', 'public', 'linkedin_accounts', 'idx_linkedin_accounts_org', '', '', true),
    (437, '023_multichannel.sql', 'index', 'public', 'linkedin_actions', 'idx_li_actions_lead', '', '', true),
    (438, '023_multichannel.sql', 'index', 'public', 'linkedin_actions', 'idx_li_actions_enrollment', '', '', true),
    (439, '023_multichannel.sql', 'index', 'public', 'linkedin_actions', 'idx_li_actions_status', '', '', true),
    (440, '023_multichannel.sql', 'index', 'public', 'linkedin_actions', 'idx_li_actions_type', '', '', true),
    (441, '023_multichannel.sql', 'trigger', 'public', 'whatsapp_accounts', 'set_whatsapp_accounts_updated_at', '', '', true),
    (442, '023_multichannel.sql', 'trigger', 'public', 'whatsapp_templates', 'set_whatsapp_templates_updated_at', '', '', true),
    (443, '023_multichannel.sql', 'trigger', 'public', 'linkedin_accounts', 'set_linkedin_accounts_updated_at', '', '', true),
    (444, '023_multichannel.sql', 'rls', 'public', 'whatsapp_accounts', 'whatsapp_accounts', '', '', true),
    (445, '023_multichannel.sql', 'rls', 'public', 'whatsapp_templates', 'whatsapp_templates', '', '', true),
    (446, '023_multichannel.sql', 'rls', 'public', 'whatsapp_messages', 'whatsapp_messages', '', '', true),
    (447, '023_multichannel.sql', 'rls', 'public', 'linkedin_accounts', 'linkedin_accounts', '', '', true),
    (448, '023_multichannel.sql', 'rls', 'public', 'linkedin_actions', 'linkedin_actions', '', '', true),
    (449, '023_multichannel.sql', 'policy', 'public', 'whatsapp_templates', 'whatsapp_templates_org_scope', '', '', true),
    (450, '023_multichannel.sql', 'policy', 'public', 'whatsapp_messages', 'whatsapp_messages_org_scope', '', '', true),
    (451, '023_multichannel.sql', 'policy', 'public', 'linkedin_actions', 'linkedin_actions_org_scope', '', '', true),
    (452, '028_security_hardening.sql', 'function', 'public', '', 'protect_profile_tenant_columns', '', '', true),
    (453, '028_security_hardening.sql', 'trigger', 'public', 'profiles', 'protect_profile_tenant_columns', '', '', true),
    (454, '028_security_hardening.sql', 'rls', 'public', 'automation_executions', 'automation_executions', '', '', true),
    (455, '028_security_hardening.sql', 'rls', 'public', 'campaign_leads', 'campaign_leads', '', '', true),
    (456, '028_security_hardening.sql', 'policy', 'public', 'automation_executions', 'automation_executions_org_isolation', '', '', true),
    (457, '028_security_hardening.sql', 'policy', 'public', 'automation_executions', 'Service role full access to automation_executions', '', '', true),
    (458, '028_security_hardening.sql', 'policy', 'public', 'campaign_leads', 'campaign_leads_org_isolation', '', '', true),
    (459, '028_security_hardening.sql', 'policy', 'public', 'campaign_leads', 'Service role full access to campaign_leads', '', '', true),
    (460, '028_security_hardening.sql', 'policy', 'public', 'sequence_enrollments', 'Service role full access to sequence_enrollments', '', '', true),
    (461, '028_security_hardening.sql', 'policy', 'public', 'email_messages', 'Service role full access to email_messages', '', '', true),
    (462, '028_security_hardening.sql', 'policy_def', 'public', 'profiles', 'Users can update own profile', '', '%auth.uid()%', true),
    (463, '028_security_hardening.sql', 'policy_def', 'public', 'sequence_enrollments', 'sequence_enrollments_via_sequence', '', '%lead_id%', true),
    (464, '028_security_hardening.sql', 'policy_def', 'public', 'email_messages', 'org_email_messages', '', '%email_account_id%', true),
    (465, '029_open_access_guests.sql', 'function_def', 'public', '', 'handle_new_user', '', '%guest.local%', true),
    (466, '030_followup.sql', 'function_config', 'public', '', 'increment_daily_sent_count', 'uuid', 'search_path=public', true),
    (467, '030_followup.sql', 'function_config', 'public', '', 'increment_message_open_count', 'uuid', 'search_path=public', true),
    (468, '030_followup.sql', 'function_config', 'public', '', 'increment_message_click_count', 'uuid', 'search_path=public', true),
    (469, '030_followup.sql', 'function_config', 'public', '', 'increment_link_click_count', 'uuid', 'search_path=public', true),
    (470, '030_followup.sql', 'function_config', 'public', '', 'reset_daily_sent_counts', '', 'search_path=public', true),
    (471, '030_followup.sql', 'function_config', 'public', '', 'increment_automation_rule_count', 'uuid', 'search_path=public', true),
    (472, '030_followup.sql', 'function_privilege', 'public', 'anon', 'increment_daily_sent_count', 'uuid', 'EXECUTE', false),
    (473, '030_followup.sql', 'function_privilege', 'public', 'authenticated', 'increment_daily_sent_count', 'uuid', 'EXECUTE', false),
    (474, '030_followup.sql', 'function_privilege', 'public', 'anon', 'increment_message_open_count', 'uuid', 'EXECUTE', false),
    (475, '030_followup.sql', 'function_privilege', 'public', 'authenticated', 'increment_message_open_count', 'uuid', 'EXECUTE', false),
    (476, '030_followup.sql', 'function_privilege', 'public', 'anon', 'increment_message_click_count', 'uuid', 'EXECUTE', false),
    (477, '030_followup.sql', 'function_privilege', 'public', 'authenticated', 'increment_message_click_count', 'uuid', 'EXECUTE', false),
    (478, '030_followup.sql', 'function_privilege', 'public', 'anon', 'increment_link_click_count', 'uuid', 'EXECUTE', false),
    (479, '030_followup.sql', 'function_privilege', 'public', 'authenticated', 'increment_link_click_count', 'uuid', 'EXECUTE', false),
    (480, '030_followup.sql', 'function_privilege', 'public', 'anon', 'reset_daily_sent_counts', '', 'EXECUTE', false),
    (481, '030_followup.sql', 'function_privilege', 'public', 'authenticated', 'reset_daily_sent_counts', '', 'EXECUTE', false),
    (482, '030_followup.sql', 'function_privilege', 'public', 'anon', 'increment_automation_rule_count', 'uuid', 'EXECUTE', false),
    (483, '030_followup.sql', 'function_privilege', 'public', 'authenticated', 'increment_automation_rule_count', 'uuid', 'EXECUTE', false),
    (484, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'default_model', 'authenticated', 'SELECT', true),
    (485, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'api_key', 'authenticated', 'SELECT', false),
    (486, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'openai_api_key', 'authenticated', 'SELECT', false),
    (487, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'openrouter_api_key', 'authenticated', 'SELECT', false),
    (488, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'groq_api_key', 'authenticated', 'SELECT', false),
    (489, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'apify_api_key', 'authenticated', 'SELECT', false),
    (490, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'openrouter_oauth_token', 'authenticated', 'SELECT', false),
    (491, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'openrouter_code_verifier', 'authenticated', 'SELECT', false),
    (492, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'tokens_used_today', 'authenticated', 'UPDATE', false),
    (493, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'tokens_used_today', 'authenticated', 'INSERT', false),
    (494, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'tokens_used_month', 'authenticated', 'UPDATE', false),
    (495, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'tokens_used_month', 'authenticated', 'INSERT', false),
    (496, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'daily_token_limit', 'authenticated', 'UPDATE', false),
    (497, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'daily_token_limit', 'authenticated', 'INSERT', false),
    (498, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'monthly_token_limit', 'authenticated', 'UPDATE', false),
    (499, '030_followup.sql', 'column_privilege', 'public', 'ai_settings', 'monthly_token_limit', 'authenticated', 'INSERT', false),
    (500, '030_followup.sql', 'policy_def', 'public', 'campaign_leads', 'campaign_leads_org_isolation', '', '%lead_id IS NULL%', true),
    (501, '030_followup.sql', 'policy_def', 'public', 'automation_executions', 'automation_executions_org_isolation', '', '%lead_id IS NULL%', true),
    (502, '031_account_role_rls.sql', 'function', 'public', '', 'protect_email_account_credentials', '', '', true),
    (503, '031_account_role_rls.sql', 'trigger', 'public', 'email_accounts', 'protect_email_account_credentials', '', '', true),
    (504, '031_account_role_rls.sql', 'policy', 'public', 'email_accounts', 'email_accounts_select', '', '', true),
    (505, '031_account_role_rls.sql', 'policy', 'public', 'email_accounts', 'email_accounts_insert', '', '', true),
    (506, '031_account_role_rls.sql', 'policy', 'public', 'email_accounts', 'email_accounts_update', '', '', true),
    (507, '031_account_role_rls.sql', 'policy', 'public', 'email_accounts', 'email_accounts_delete', '', '', true),
    (508, '031_account_role_rls.sql', 'policy', 'public', 'whatsapp_accounts', 'whatsapp_accounts_select', '', '', true),
    (509, '031_account_role_rls.sql', 'policy', 'public', 'whatsapp_accounts', 'whatsapp_accounts_insert', '', '', true),
    (510, '031_account_role_rls.sql', 'policy', 'public', 'whatsapp_accounts', 'whatsapp_accounts_update', '', '', true),
    (511, '031_account_role_rls.sql', 'policy', 'public', 'whatsapp_accounts', 'whatsapp_accounts_delete', '', '', true),
    (512, '031_account_role_rls.sql', 'policy', 'public', 'linkedin_accounts', 'linkedin_accounts_select', '', '', true),
    (513, '031_account_role_rls.sql', 'policy', 'public', 'linkedin_accounts', 'linkedin_accounts_insert', '', '', true),
    (514, '031_account_role_rls.sql', 'policy', 'public', 'linkedin_accounts', 'linkedin_accounts_update', '', '', true),
    (515, '031_account_role_rls.sql', 'policy', 'public', 'linkedin_accounts', 'linkedin_accounts_delete', '', '', true),
    (516, '031_account_role_rls.sql', 'policy', 'public', 'email_accounts', 'org_email_accounts', '', '', false),
    (517, '031_account_role_rls.sql', 'policy', 'public', 'email_accounts', 'Users can view own org email_accounts', '', '', false),
    (518, '031_account_role_rls.sql', 'policy', 'public', 'email_accounts', 'Users can insert own org email_accounts', '', '', false),
    (519, '031_account_role_rls.sql', 'policy', 'public', 'email_accounts', 'Users can update own org email_accounts', '', '', false),
    (520, '031_account_role_rls.sql', 'policy', 'public', 'email_accounts', 'Users can delete own org email_accounts', '', '', false),
    (521, '031_account_role_rls.sql', 'policy', 'public', 'whatsapp_accounts', 'whatsapp_accounts_org_scope', '', '', false),
    (522, '031_account_role_rls.sql', 'policy', 'public', 'linkedin_accounts', 'linkedin_accounts_org_scope', '', '', false),
    (523, '032_avatar_storage.sql', 'policy', 'storage', 'objects', 'avatars_insert_own', '', '', true),
    (524, '032_avatar_storage.sql', 'policy', 'storage', 'objects', 'avatars_update_own', '', '', true),
    (525, '032_avatar_storage.sql', 'policy', 'storage', 'objects', 'avatars_delete_own', '', '', true),
    (526, '032_avatar_storage.sql', 'policy', 'storage', 'objects', 'Authenticated users can upload avatars', '', '', false),
    (527, '032_avatar_storage.sql', 'policy', 'storage', 'objects', 'Users can update own avatars', '', '', false),
    (528, '032_avatar_storage.sql', 'policy', 'storage', 'objects', 'Users can delete own avatars', '', '', false),
    (529, '033_custom_ai_provider.sql', 'column', 'public', 'ai_settings', 'custom_base_url', '', '', true),
    (530, '033_custom_ai_provider.sql', 'column', 'public', 'ai_settings', 'custom_api_key', '', '', true),
    (531, '033_custom_ai_provider.sql', 'column', 'public', 'ai_settings', 'custom_model', '', '', true),
    (532, '033_custom_ai_provider.sql', 'column', 'public', 'ai_settings', 'custom_fast_model', '', '', true),
    (533, '033_custom_ai_provider.sql', 'constraint_def', 'public', 'ai_settings', 'ai_settings_ai_provider_check', '', '%custom%', true),
    (534, '033_custom_ai_provider.sql', 'constraint_def', 'public', 'lf_campaigns', 'lf_campaigns_ai_provider_check', '', '%custom%', true),
    (535, '033_custom_ai_provider.sql', 'constraint_def', 'public', 'lf_llm_costs', 'lf_llm_costs_provider_check', '', '%custom%', true),
    (536, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_base_url', 'authenticated', 'SELECT', true),
    (537, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_model', 'authenticated', 'SELECT', true),
    (538, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_fast_model', 'authenticated', 'SELECT', true),
    (539, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_api_key', 'authenticated', 'SELECT', false),
    (540, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_base_url', 'authenticated', 'UPDATE', false),
    (541, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_base_url', 'authenticated', 'INSERT', false),
    (542, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_api_key', 'authenticated', 'UPDATE', false),
    (543, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_api_key', 'authenticated', 'INSERT', false),
    (544, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_model', 'authenticated', 'UPDATE', false),
    (545, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_model', 'authenticated', 'INSERT', false),
    (546, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_fast_model', 'authenticated', 'UPDATE', false),
    (547, '033_custom_ai_provider.sql', 'column_privilege', 'public', 'ai_settings', 'custom_fast_model', 'authenticated', 'INSERT', false),
    (548, '035_deal_stage_changed_at.sql', 'column', 'public', 'deals', 'stage_changed_at', '', '', true),
    (549, '035_deal_stage_changed_at.sql', 'column_default', 'public', 'deals', 'stage_changed_at', '', 'now()', true),
    (550, '035_deal_stage_changed_at.sql', 'trigger_enabled', 'public', 'deals', 'set_updated_at', '', '', true),
    (551, '021_unmigrated_tables.sql', 'table', 'public', '', 'apify_scraper_runs', '', '', true),
    (552, '021_unmigrated_tables.sql', 'table', 'public', '', 'campaign_tags', '', '', true),
    (553, '021_unmigrated_tables.sql', 'table', 'public', '', 'copilot_conversations', '', '', true),
    (554, '021_unmigrated_tables.sql', 'table', 'public', '', 'copilot_memory', '', '', true),
    (555, '021_unmigrated_tables.sql', 'table', 'public', '', 'copilot_messages', '', '', true),
    (556, '021_unmigrated_tables.sql', 'table', 'public', '', 'copilot_tasks', '', '', true),
    (557, '021_unmigrated_tables.sql', 'table', 'public', '', 'lead_searches', '', '', true),
    (558, '021_unmigrated_tables.sql', 'table', 'public', '', 'scraped_leads', '', '', true),
    (559, '021_unmigrated_tables.sql', 'table', 'public', '', 'sequence_email_accounts', '', '', true),
    (560, '021_unmigrated_tables.sql', 'table', 'public', '', 'sequence_tags', '', '', true),
    (561, '021_unmigrated_tables.sql', 'table', 'public', '', 'tracking_scripts', '', '', true),
    (562, '021_unmigrated_tables.sql', 'table', 'public', '', 'website_visitors', '', '', true),
    (563, '021_unmigrated_tables.sql', 'table', 'public', '', 'website_visits', '', '', true),
    (564, '021_unmigrated_tables.sql', 'index', 'public', 'website_visitors', 'idx_website_visitors_last_seen', '', '', true),
    (565, '021_unmigrated_tables.sql', 'index', 'public', 'website_visitors', 'idx_website_visitors_org', '', '', true),
    (566, '021_unmigrated_tables.sql', 'index', 'public', 'website_visitors', 'idx_website_visitors_status', '', '', true),
    (567, '021_unmigrated_tables.sql', 'index', 'public', 'website_visits', 'idx_website_visits_created', '', '', true),
    (568, '021_unmigrated_tables.sql', 'index', 'public', 'website_visits', 'idx_website_visits_org', '', '', true),
    (569, '021_unmigrated_tables.sql', 'index', 'public', 'website_visits', 'idx_website_visits_visitor', '', '', true),
    (570, '021_unmigrated_tables.sql', 'trigger', 'public', 'copilot_conversations', 'update_copilot_conversations_updated_at', '', '', true),
    (571, '021_unmigrated_tables.sql', 'trigger', 'public', 'copilot_memory', 'update_copilot_memory_updated_at', '', '', true),
    (572, '021_unmigrated_tables.sql', 'trigger', 'public', 'copilot_tasks', 'update_copilot_tasks_updated_at', '', '', true),
    (573, '021_unmigrated_tables.sql', 'trigger', 'public', 'lead_searches', 'update_lead_searches_updated_at', '', '', true),
    (574, '021_unmigrated_tables.sql', 'trigger', 'public', 'tracking_scripts', 'set_tracking_scripts_updated_at', '', '', true),
    (575, '021_unmigrated_tables.sql', 'trigger', 'public', 'website_visitors', 'set_website_visitors_updated_at', '', '', true),
    (576, '021_unmigrated_tables.sql', 'rls', 'public', 'apify_scraper_runs', 'apify_scraper_runs', '', '', true),
    (577, '021_unmigrated_tables.sql', 'rls', 'public', 'campaign_tags', 'campaign_tags', '', '', true),
    (578, '021_unmigrated_tables.sql', 'rls', 'public', 'copilot_conversations', 'copilot_conversations', '', '', true),
    (579, '021_unmigrated_tables.sql', 'rls', 'public', 'copilot_memory', 'copilot_memory', '', '', true),
    (580, '021_unmigrated_tables.sql', 'rls', 'public', 'copilot_messages', 'copilot_messages', '', '', true),
    (581, '021_unmigrated_tables.sql', 'rls', 'public', 'copilot_tasks', 'copilot_tasks', '', '', true),
    (582, '021_unmigrated_tables.sql', 'rls', 'public', 'lead_searches', 'lead_searches', '', '', true),
    (583, '021_unmigrated_tables.sql', 'rls', 'public', 'scraped_leads', 'scraped_leads', '', '', true),
    (584, '021_unmigrated_tables.sql', 'rls', 'public', 'sequence_email_accounts', 'sequence_email_accounts', '', '', true),
    (585, '021_unmigrated_tables.sql', 'rls', 'public', 'sequence_tags', 'sequence_tags', '', '', true),
    (586, '021_unmigrated_tables.sql', 'rls', 'public', 'tracking_scripts', 'tracking_scripts', '', '', true),
    (587, '021_unmigrated_tables.sql', 'rls', 'public', 'website_visitors', 'website_visitors', '', '', true),
    (588, '021_unmigrated_tables.sql', 'rls', 'public', 'website_visits', 'website_visits', '', '', true),
    (589, '021_unmigrated_tables.sql', 'policy', 'public', 'apify_scraper_runs', 'org_access', '', '', true),
    (590, '021_unmigrated_tables.sql', 'policy', 'public', 'copilot_conversations', 'org_access', '', '', true),
    (591, '021_unmigrated_tables.sql', 'policy', 'public', 'copilot_memory', 'org_access', '', '', true),
    (592, '021_unmigrated_tables.sql', 'policy', 'public', 'copilot_messages', 'org_access', '', '', true),
    (593, '021_unmigrated_tables.sql', 'policy', 'public', 'copilot_tasks', 'org_access', '', '', true),
    (594, '021_unmigrated_tables.sql', 'policy', 'public', 'campaign_tags', 'Users can view own org campaign_tags', '', '', true),
    (595, '021_unmigrated_tables.sql', 'policy', 'public', 'campaign_tags', 'Users can insert own org campaign_tags', '', '', true),
    (596, '021_unmigrated_tables.sql', 'policy', 'public', 'campaign_tags', 'Users can delete own org campaign_tags', '', '', true),
    (597, '021_unmigrated_tables.sql', 'policy', 'public', 'lead_searches', 'Users can view own org lead_searches', '', '', true),
    (598, '021_unmigrated_tables.sql', 'policy', 'public', 'lead_searches', 'Users can insert own org lead_searches', '', '', true),
    (599, '021_unmigrated_tables.sql', 'policy', 'public', 'lead_searches', 'Users can update own org lead_searches', '', '', true),
    (600, '021_unmigrated_tables.sql', 'policy', 'public', 'lead_searches', 'Users can delete own org lead_searches', '', '', true),
    (601, '021_unmigrated_tables.sql', 'policy', 'public', 'scraped_leads', 'Users can view own org scraped_leads', '', '', true),
    (602, '021_unmigrated_tables.sql', 'policy', 'public', 'scraped_leads', 'Users can insert own org scraped_leads', '', '', true),
    (603, '021_unmigrated_tables.sql', 'policy', 'public', 'scraped_leads', 'Users can update own org scraped_leads', '', '', true),
    (604, '021_unmigrated_tables.sql', 'policy', 'public', 'scraped_leads', 'Users can delete own org scraped_leads', '', '', true),
    (605, '021_unmigrated_tables.sql', 'policy', 'public', 'sequence_email_accounts', 'Users can manage sequence_email_accounts', '', '', true),
    (606, '021_unmigrated_tables.sql', 'policy', 'public', 'sequence_tags', 'Users can manage sequence_tags', '', '', true),
    (607, '021_unmigrated_tables.sql', 'policy', 'public', 'tracking_scripts', 'Users can manage own org tracking scripts', '', '', true),
    (608, '021_unmigrated_tables.sql', 'policy', 'public', 'website_visitors', 'Users can manage own org visitors', '', '', true),
    (609, '021_unmigrated_tables.sql', 'policy', 'public', 'website_visits', 'Users can view own org visits', '', '', true),
    (610, '036_api_keys.sql', 'table', 'public', '', 'api_keys', '', '', true),
    (611, '036_api_keys.sql', 'index', 'public', 'api_keys', 'idx_api_keys_org', '', '', true),
    (612, '036_api_keys.sql', 'rls', 'public', 'api_keys', 'api_keys', '', '', true),
    (613, '036_api_keys.sql', 'policy', 'public', 'api_keys', 'api_keys_select_admin', '', '', true)
),

-- policies a repo migration created and a later one dropped: if still present
-- they show as SHOULD_BE_ABSENT in section 3, so section 2 leaves them out
retired (sch, rel, obj, created_in, dropped_in) AS (
  VALUES
    ('public', 'email_accounts', 'org_email_accounts', '016_email_system.sql', '031_account_role_rls.sql'),
    ('public', 'whatsapp_accounts', 'whatsapp_accounts_org_scope', '023_multichannel.sql', '031_account_role_rls.sql'),
    ('public', 'linkedin_accounts', 'linkedin_accounts_org_scope', '023_multichannel.sql', '031_account_role_rls.sql'),
    ('storage', 'objects', 'Authenticated users can upload avatars', '001_initial_schema.sql', '032_avatar_storage.sql'),
    ('storage', 'objects', 'Users can update own avatars', '001_initial_schema.sql', '032_avatar_storage.sql'),
    ('storage', 'objects', 'Users can delete own avatars', '001_initial_schema.sql', '032_avatar_storage.sql')
),

checked AS (
  SELECT
    m.ord,
    e.seq,
    e.file,
    e.kind,
    e.expect_present,
    CASE e.kind
      WHEN 'enum'           THEN format('%s.%s', e.sch, e.obj)
      WHEN 'table'          THEN format('%s.%s', e.sch, e.obj)
      WHEN 'column'         THEN format('%s.%s.%s', e.sch, e.rel, e.obj)
      WHEN 'column_default' THEN format('%s.%s.%s DEFAULT %s', e.sch, e.rel, e.obj, e.pat)
      WHEN 'trigger_enabled' THEN format('%s.%s: %s (enabled)', e.sch, e.rel, e.obj)
      WHEN 'constraint_def' THEN format('%s.%s: %s (definition LIKE %s)', e.sch, e.rel, e.obj, e.pat)
      WHEN 'index'          THEN format('%s.%s (on %s)', e.sch, e.obj, e.rel)
      WHEN 'function'       THEN format('%s.%s(%s)', e.sch, e.obj, e.arg)
      WHEN 'function_def'   THEN format('%s.%s(%s) body ILIKE %s', e.sch, e.obj, e.arg, e.pat)
      WHEN 'function_config' THEN format('%s.%s(%s) SET %s', e.sch, e.obj, e.arg, e.pat)
      WHEN 'function_privilege' THEN format('%s has %s on %s.%s(%s)', e.rel, e.pat, e.sch, e.obj, e.arg)
      WHEN 'column_privilege' THEN format('%s has %s on %s.%s.%s', e.arg, e.pat, e.sch, e.rel, e.obj)
      WHEN 'trigger'        THEN format('%s.%s: %s', e.sch, e.rel, e.obj)
      WHEN 'rls'            THEN format('%s.%s (row level security enabled)', e.sch, e.rel)
      WHEN 'policy'         THEN format('%s.%s: "%s"', e.sch, e.rel, e.obj)
      WHEN 'policy_def'     THEN format('%s.%s: "%s" WITH CHECK LIKE %s', e.sch, e.rel, e.obj, e.pat)
      WHEN 'bucket'         THEN format('storage.buckets: %s', e.obj)
    END AS object,
    CASE e.kind
      WHEN 'enum' THEN EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = e.sch AND t.typname = e.obj AND t.typtype = 'e')
      WHEN 'table' THEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = e.sch AND c.relname = e.obj AND c.relkind IN ('r', 'p'))
      WHEN 'column' THEN EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = e.sch AND c.relname = e.rel AND a.attname = e.obj
          AND a.attnum > 0 AND NOT a.attisdropped)
      WHEN 'column_default' THEN EXISTS (
        SELECT 1 FROM pg_attrdef d
        JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
        JOIN pg_class c ON c.oid = d.adrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = e.sch AND c.relname = e.rel AND a.attname = e.obj
          AND NOT a.attisdropped AND pg_get_expr(d.adbin, d.adrelid) = e.pat)
      WHEN 'trigger_enabled' THEN EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = e.sch AND c.relname = e.rel AND t.tgname = e.obj
          AND NOT t.tgisinternal AND t.tgenabled <> 'D')
      WHEN 'constraint_def' THEN EXISTS (
        SELECT 1 FROM pg_constraint k
        JOIN pg_class c ON c.oid = k.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = e.sch AND c.relname = e.rel AND k.conname = e.obj
          AND pg_get_constraintdef(k.oid) LIKE e.pat)
      WHEN 'index' THEN EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_class tc ON tc.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = ic.relnamespace
        WHERE n.nspname = e.sch AND ic.relname = e.obj AND tc.relname = e.rel)
      WHEN 'function' THEN
        to_regprocedure(format('%I.%I(%s)', e.sch, e.obj, e.arg)) IS NOT NULL
      WHEN 'function_def' THEN EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.oid = to_regprocedure(format('%I.%I(%s)', e.sch, e.obj, e.arg))
          AND p.prosrc ILIKE e.pat)
      WHEN 'function_config' THEN EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.oid = to_regprocedure(format('%I.%I(%s)', e.sch, e.obj, e.arg))
          AND e.pat = ANY (coalesce(p.proconfig, '{}'::text[])))
      WHEN 'function_privilege' THEN
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = e.rel)
             THEN has_function_privilege(e.rel, to_regprocedure(format('%I.%I(%s)', e.sch, e.obj, e.arg)), e.pat)
        END  -- NULL when the role or the function does not exist
      WHEN 'column_privilege' THEN
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = e.arg)
             THEN has_column_privilege(
                    e.arg,
                    to_regclass(format('%I.%I', e.sch, e.rel)),
                    (SELECT a.attnum FROM pg_attribute a
                     WHERE a.attrelid = to_regclass(format('%I.%I', e.sch, e.rel))
                       AND a.attname = e.obj AND a.attnum > 0 AND NOT a.attisdropped),
                    e.pat)
        END  -- NULL when the role, table or column does not exist
      WHEN 'trigger' THEN EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = e.sch AND c.relname = e.rel AND t.tgname = e.obj
          AND NOT t.tgisinternal)
      WHEN 'rls' THEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = e.sch AND c.relname = e.rel AND c.relrowsecurity)
      WHEN 'policy' THEN EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = e.sch AND p.tablename = e.rel AND p.policyname = e.obj)
      WHEN 'policy_def' THEN EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = e.sch AND p.tablename = e.rel AND p.policyname = e.obj
          AND coalesce(p.with_check, '') LIKE e.pat)
      WHEN 'bucket' THEN EXISTS (
        SELECT 1 FROM storage.buckets b WHERE b.id = e.obj)
    END AS present
  FROM expected e
  JOIN migrations m ON m.file = e.file
),

graded AS (
  SELECT c.*,
         CASE
           WHEN c.present IS NULL THEN 'SKIPPED'
           WHEN c.present = c.expect_present THEN 'OK'
           WHEN c.expect_present THEN 'MISSING'
           ELSE 'SHOULD_BE_ABSENT'
         END AS status
  FROM checked c
),

summary AS (
  SELECT m.ord, m.file,
         count(g.seq)                                           AS n_checks,
         count(g.seq) FILTER (WHERE g.status IN ('MISSING', 'SHOULD_BE_ABSENT')) AS n_failing,
         count(g.seq) FILTER (WHERE g.status = 'SKIPPED')      AS n_skipped,
         string_agg(g.kind || ' ' || g.object, '; ' ORDER BY g.seq)
           FILTER (WHERE g.status IN ('MISSING', 'SHOULD_BE_ABSENT')) AS failing
  FROM migrations m
  LEFT JOIN graded g ON g.file = m.file
  GROUP BY m.ord, m.file
),

unexpected AS (
  SELECT p.schemaname, p.tablename, p.policyname, p.cmd, p.roles
  FROM pg_policies p
  WHERE p.schemaname IN ('public', 'storage')
    AND NOT EXISTS (
      SELECT 1 FROM expected e
      WHERE e.kind IN ('policy', 'policy_def') AND e.expect_present
        AND e.sch = p.schemaname AND e.rel = p.tablename AND e.obj = p.policyname)
    AND NOT EXISTS (
      SELECT 1 FROM retired r
      WHERE r.sch = p.schemaname AND r.rel = p.tablename AND r.obj = p.policyname)
)

SELECT '1_summary' AS section, s.ord, s.file AS migration, 'SUMMARY' AS kind,
       format('%s of %s checks failing: %s', s.n_failing, s.n_checks, s.failing) AS object,
       NULL::boolean AS present, NULL::text AS expected,
       CASE WHEN s.n_failing = s.n_checks - s.n_skipped THEN 'NOT_APPLIED'
            ELSE 'PARTIAL' END AS status,
       0 AS seq
FROM summary s
WHERE s.n_failing > 0

UNION ALL
SELECT '2_unexpected', NULL, NULL, 'policy (not in any migration)',
       format('%s.%s: "%s" (FOR %s, TO %s) -- likely dashboard-created', u.schemaname, u.tablename,
              u.policyname, u.cmd, array_to_string(u.roles, ',')),
       true, 'absent', 'UNEXPECTED', 0
FROM unexpected u

UNION ALL
SELECT '3_detail', g.ord, g.file, g.kind, g.object, g.present,
       CASE WHEN g.expect_present THEN 'present' ELSE 'absent' END,
       g.status, g.seq
FROM graded g

ORDER BY section, ord NULLS LAST, seq, object;
