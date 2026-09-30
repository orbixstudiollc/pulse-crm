-- ============================================================
-- 034 Normalize demo-seed values to the ids the UI filters on
--
-- The demo seed (lib/seed/generate.ts) used to write display labels where the
-- UI filters on ids, which emptied tabs on Templates, Sequences, Playbook,
-- Competitors and Contacts, and wrote ICP criteria/weights in a legacy shape
-- that broke the ICP detail page. The seed now writes ids and the ICPCriteria /
-- ICPWeights shapes from lib/actions/icp.ts; this migration rewrites rows that
-- were already seeded with the old values, using the same mappings:
--
--   email_templates.category     Outreach->cold_outreach, Follow-up->follow_up,
--                                Proposal->general, Re-engagement->re_engagement,
--                                Scheduling->meeting, Onboarding->nurture
--   sequences.category           Nurture->nurture, Outreach->cold_outreach
--   objection_playbook.category  price->pricing, trust->implementation
--   competitors.category         Direct Competitor->direct,
--                                Enterprise Competitor->aspirational,
--                                Budget Competitor->indirect
--   contacts.buying_role         Decision Maker->economic_buyer,
--                                Influencer->technical_evaluator,
--                                Champion->champion, Gatekeeper->blocker,
--                                End User->end_user
--   icp_profiles.criteria        legacy {industry, company_size, revenue,
--                                tech_stack, geography, pain_points,
--                                growth_rate} -> ICPCriteria
--   icp_profiles.weights         legacy {company_size, ...} -> ICPWeights; the two
--                                seeded profiles (Enterprise SaaS, Growth-Stage
--                                Startup) get exactly the seed's weights, any
--                                other profile is derived by formula
--
-- DATA-ONLY: no schema, grant or RLS changes. Idempotent: every UPDATE only
-- matches rows still holding the old values, so re-running changes nothing.
--
-- Run manually in the Supabase SQL editor.
-- ============================================================

BEGIN;

-- ── email_templates.category ────────────────────────────────
UPDATE email_templates
SET category = CASE category
  WHEN 'Outreach'      THEN 'cold_outreach'
  WHEN 'Follow-up'     THEN 'follow_up'
  WHEN 'Proposal'      THEN 'general'
  WHEN 'Re-engagement' THEN 're_engagement'
  WHEN 'Scheduling'    THEN 'meeting'
  WHEN 'Onboarding'    THEN 'nurture'
END
WHERE category IN ('Outreach', 'Follow-up', 'Proposal', 'Re-engagement', 'Scheduling', 'Onboarding');

-- ── sequences.category ──────────────────────────────────────
UPDATE sequences
SET category = CASE category
  WHEN 'Nurture'  THEN 'nurture'
  WHEN 'Outreach' THEN 'cold_outreach'
END
WHERE category IN ('Nurture', 'Outreach');

-- ── objection_playbook.category ─────────────────────────────
UPDATE objection_playbook
SET category = CASE category
  WHEN 'price' THEN 'pricing'
  WHEN 'trust' THEN 'implementation'
END
WHERE category IN ('price', 'trust');

-- ── competitors.category ────────────────────────────────────
UPDATE competitors
SET category = CASE category
  WHEN 'Direct Competitor'     THEN 'direct'
  WHEN 'Enterprise Competitor' THEN 'aspirational'
  WHEN 'Budget Competitor'     THEN 'indirect'
END
WHERE category IN ('Direct Competitor', 'Enterprise Competitor', 'Budget Competitor');

-- ── contacts.buying_role ────────────────────────────────────
UPDATE contacts
SET buying_role = CASE buying_role
  WHEN 'Decision Maker' THEN 'economic_buyer'
  WHEN 'Influencer'     THEN 'technical_evaluator'
  WHEN 'Champion'       THEN 'champion'
  WHEN 'Gatekeeper'     THEN 'blocker'
  WHEN 'End User'       THEN 'end_user'
END
WHERE buying_role IN ('Decision Maker', 'Influencer', 'Champion', 'Gatekeeper', 'End User');

-- ── icp_profiles.criteria ───────────────────────────────────
-- company_sizes: every UI size option overlapping company_size [min, max]
-- (a missing bound is unbounded; no company_size at all -> []).
-- pain_points: legacy names in order, severity 8, 7, 6, ... floored at 1.
-- growth_rate '20%+ YoY' -> behavioral.trigger_events ['20%+ YoY growth'].
-- Any missing legacy key becomes the empty default.
UPDATE icp_profiles p
SET criteria = jsonb_build_object(
  'firmographic', jsonb_build_object(
    'industries', CASE WHEN jsonb_typeof(p.criteria -> 'industry') = 'array'
                       THEN p.criteria -> 'industry' ELSE '[]'::jsonb END,
    'company_sizes', COALESCE((
      SELECT jsonb_agg(o.label ORDER BY o.ord)
      FROM (VALUES
        (1, '1-10',      1,    10),
        (2, '11-50',     11,   50),
        (3, '51-200',    51,   200),
        (4, '201-500',   201,  500),
        (5, '501-1000',  501,  1000),
        (6, '1001-5000', 1001, 5000),
        (7, '5000+',     5000, NULL)
      ) AS o(ord, label, lo, hi)
      CROSS JOIN (
        SELECT (p.criteria -> 'company_size' ->> 'min')::numeric AS mn,
               (p.criteria -> 'company_size' ->> 'max')::numeric AS mx
      ) AS b
      WHERE (b.mn IS NOT NULL OR b.mx IS NOT NULL)
        AND (b.mx IS NULL OR o.lo <= b.mx)
        AND (b.mn IS NULL OR o.hi IS NULL OR o.hi >= b.mn)
    ), '[]'::jsonb),
    'employee_range', jsonb_build_object(
      'min', p.criteria -> 'company_size' -> 'min',
      'max', p.criteria -> 'company_size' -> 'max'
    ),
    'geography', CASE WHEN jsonb_typeof(p.criteria -> 'geography') = 'array'
                      THEN p.criteria -> 'geography' ELSE '[]'::jsonb END
  ),
  'technographic', jsonb_build_object(
    'tech_stack', CASE WHEN jsonb_typeof(p.criteria -> 'tech_stack') = 'array'
                       THEN p.criteria -> 'tech_stack' ELSE '[]'::jsonb END,
    'tech_sophistication_min', 0
  ),
  'behavioral', jsonb_build_object(
    'buying_patterns', '[]'::jsonb,
    'trigger_events', CASE WHEN jsonb_typeof(p.criteria -> 'growth_rate') = 'string'
                           THEN jsonb_build_array((p.criteria ->> 'growth_rate') || ' growth')
                           ELSE '[]'::jsonb END
  ),
  'pain_points', COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object('name', e.name, 'severity', GREATEST(9 - e.ord, 1))
             ORDER BY e.ord
           )
    FROM jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(p.criteria -> 'pain_points') = 'array'
                THEN p.criteria -> 'pain_points' ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS e(name, ord)
  ), '[]'::jsonb),
  'budget', jsonb_build_object(
    'revenue_range', jsonb_build_object(
      'min', p.criteria -> 'revenue' -> 'min',
      'max', p.criteria -> 'revenue' -> 'max'
    ),
    'deal_size_sweet_spot', NULL,
    'funding_stages', '[]'::jsonb
  ),
  'channel', jsonb_build_object(
    'preferred_contact_methods', '[]'::jsonb,
    'content_preferences', '[]'::jsonb
  )
)
WHERE p.criteria ? 'industry'
  AND NOT p.criteria ? 'firmographic';

-- ── icp_profiles.weights ────────────────────────────────────
-- The two seeded profiles get exactly the weights lib/seed/generate.ts writes.
-- Any other legacy row is derived by formula: {industry, size, revenue, title,
-- geography, tech}; title is fixed at 10 and tech takes the remainder of 100,
-- floored at 0.
UPDATE icp_profiles p
SET weights = CASE p.name
  WHEN 'Enterprise SaaS' THEN jsonb_build_object(
    'industry', 20, 'size', 25, 'revenue', 20, 'title', 10, 'geography', 10, 'tech', 15
  )
  WHEN 'Growth-Stage Startup' THEN jsonb_build_object(
    'industry', 20, 'size', 20, 'revenue', 15, 'title', 15, 'geography', 15, 'tech', 15
  )
  ELSE jsonb_build_object(
    'industry',  v.industry,
    'size',      v.size,
    'revenue',   v.revenue,
    'title',     10,
    'geography', v.geography,
    'tech',      GREATEST(100 - v.industry - v.size - v.revenue - 10 - v.geography, 0)
  )
END
FROM (
  SELECT id,
         COALESCE((weights ->> 'industry')::numeric, 0)     AS industry,
         COALESCE((weights ->> 'company_size')::numeric, 0) AS size,
         COALESCE((weights ->> 'revenue')::numeric, 0)      AS revenue,
         COALESCE((weights ->> 'geography')::numeric, 0)    AS geography
  FROM icp_profiles
  WHERE weights ? 'company_size'
) AS v
WHERE p.id = v.id;

COMMIT;
