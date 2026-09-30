// @vitest-environment node
import { describe, expect, it } from "vitest";
import { countSeedRows, generateSeed } from "@/lib/seed/generate";

function fixedRng(): () => number {
  let s = 42;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe("generateSeed", () => {
  it("stays between 100 and 150 rows", () => {
    const n = countSeedRows(generateSeed("org-1"));
    expect(n).toBeGreaterThanOrEqual(100);
    expect(n).toBeLessThanOrEqual(150);
  });

  it("fills the required columns", () => {
    const b = generateSeed("org-1");
    for (const lead of b.leads) {
      expect(lead.organization_id).toBe("org-1");
      expect(lead.name).toBeTruthy();
      expect(lead.email).toBeTruthy();
    }
    for (const c of b.customers) {
      expect(c.first_name).toBeTruthy();
      expect(c.last_name).toBeTruthy();
      expect(c.email).toBeTruthy();
    }
    for (const d of b.deals) expect(d.name).toBeTruthy();
    for (const a of b.activities) {
      expect(a.type).toBeTruthy();
      expect(a.title).toBeTruthy();
      expect(a.parentIndex).toBeGreaterThanOrEqual(0);
      expect(a.parentIndex).toBeLessThan(b.customers.length);
    }
  });

  it("is deterministic for a fixed rng", () => {
    expect(generateSeed("org-1", fixedRng())).toEqual(generateSeed("org-1", fixedRng()));
  });

  it("stores the category and role ids the UI filters on", () => {
    const b = generateSeed("org-1");
    const emailIds = ["general", "cold_outreach", "follow_up", "nurture", "re_engagement", "meeting"];
    const sequenceIds = ["cold_outreach", "warm_followup", "re_engagement", "post_demo", "nurture"];
    const objectionIds = ["pricing", "competition", "timing", "authority", "need", "implementation"];
    const competitorIds = ["direct", "indirect", "aspirational"];
    const roleIds = ["economic_buyer", "champion", "technical_evaluator", "end_user", "blocker", "coach"];
    for (const t of b.emailTemplates) expect(emailIds).toContain(t.category);
    for (const s of b.sequences) expect(sequenceIds).toContain(s.category);
    for (const o of b.objections) expect(objectionIds).toContain(o.category);
    for (const c of b.competitors) expect(competitorIds).toContain(c.category);
    for (const c of b.contacts) expect(roleIds).toContain(c.buying_role);
  });

  it("stores ICP criteria and weights in the shape lib/actions/icp.ts reads", () => {
    const sizeOptions = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];
    const [enterprise, startup] = generateSeed("org-1").icpProfiles;
    for (const p of [enterprise, startup]) {
      const c = p.criteria as Record<string, Record<string, unknown>>;
      expect(Object.keys(c).sort()).toEqual(
        ["behavioral", "budget", "channel", "firmographic", "pain_points", "technographic"],
      );
      expect(Object.keys(c.firmographic).sort()).toEqual(["company_sizes", "employee_range", "geography", "industries"]);
      expect(Object.keys(c.technographic).sort()).toEqual(["tech_sophistication_min", "tech_stack"]);
      expect(Object.keys(c.behavioral).sort()).toEqual(["buying_patterns", "trigger_events"]);
      expect(Object.keys(c.budget).sort()).toEqual(["deal_size_sweet_spot", "funding_stages", "revenue_range"]);
      expect(Object.keys(c.channel).sort()).toEqual(["content_preferences", "preferred_contact_methods"]);
      for (const size of c.firmographic.company_sizes as string[]) expect(sizeOptions).toContain(size);
      const w = p.weights as Record<string, number>;
      expect(Object.keys(w).sort()).toEqual(["geography", "industry", "revenue", "size", "tech", "title"]);
      expect(Object.values(w).reduce((a, n) => a + n, 0)).toBe(100);
    }
    expect(enterprise.criteria).toEqual({
      firmographic: {
        industries: ["Technology", "SaaS", "Finance"],
        company_sizes: ["51-200", "201-500", "501-1000", "1001-5000", "5000+"],
        employee_range: { min: 200, max: 10000 },
        geography: ["North America", "Europe"],
      },
      technographic: { tech_stack: ["Cloud", "API-first"], tech_sophistication_min: 0 },
      behavioral: { buying_patterns: [], trigger_events: [] },
      pain_points: [
        { name: "Manual processes", severity: 8 },
        { name: "Data silos", severity: 7 },
        { name: "Scaling challenges", severity: 6 },
      ],
      budget: { revenue_range: { min: 5000000, max: null }, deal_size_sweet_spot: null, funding_stages: [] },
      channel: { preferred_contact_methods: [], content_preferences: [] },
    });
    expect(enterprise.weights).toEqual({ industry: 20, size: 25, revenue: 20, title: 10, geography: 10, tech: 15 });
    expect(startup.criteria).toEqual({
      firmographic: {
        industries: ["Technology", "E-commerce", "Marketing"],
        company_sizes: ["11-50", "51-200"],
        employee_range: { min: 20, max: 200 },
        geography: ["North America"],
      },
      technographic: { tech_stack: [], tech_sophistication_min: 0 },
      behavioral: { buying_patterns: [], trigger_events: ["20%+ YoY growth"] },
      pain_points: [
        { name: "Outgrowing current tools", severity: 8 },
        { name: "Too much manual work", severity: 7 },
      ],
      budget: { revenue_range: { min: 1000000, max: null }, deal_size_sweet_spot: null, funding_stages: [] },
      channel: { preferred_contact_methods: [], content_preferences: [] },
    });
    expect(startup.weights).toEqual({ industry: 20, size: 20, revenue: 15, title: 15, geography: 15, tech: 15 });
  });
});
