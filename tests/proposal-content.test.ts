// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parsePricingTiers, parseProposalSections } from "@/lib/proposals/content";

describe("parseProposalSections", () => {
  it("returns [] for non-object input", () => {
    expect(parseProposalSections(null)).toEqual([]);
    expect(parseProposalSections(undefined)).toEqual([]);
    expect(parseProposalSections("text")).toEqual([]);
    expect(parseProposalSections(42)).toEqual([]);
    expect(parseProposalSections(["a", "b"])).toEqual([]);
  });

  it("orders known keys and titles them", () => {
    const sections = parseProposalSections({
      terms: "Net 30",
      next_steps: ["Kick off", "Sign"],
      executive_summary: "Summary",
      problem_statement: "Problem text",
      timeline: "Q1",
      deliverables: ["A", "B"],
      proposed_solution: "Solution",
      solution_overview: "Overview",
      pricing_section: "See below",
    });
    expect(sections.map((s) => [s.key, s.title])).toEqual([
      ["executive_summary", "Executive summary"],
      ["problem_statement", "Problem"],
      ["proposed_solution", "Proposed solution"],
      ["solution_overview", "Solution overview"],
      ["deliverables", "Deliverables"],
      ["timeline", "Timeline"],
      ["pricing_section", "Pricing"],
      ["next_steps", "Next steps"],
      ["terms", "Terms"],
    ]);
  });

  it("maps strings to text and string arrays to items", () => {
    const [summary, steps] = parseProposalSections({
      executive_summary: "Line one\nLine two",
      next_steps: ["One", "Two"],
    });
    expect(summary).toEqual({ key: "executive_summary", title: "Executive summary", text: "Line one\nLine two" });
    expect(steps).toEqual({ key: "next_steps", title: "Next steps", items: ["One", "Two"] });
  });

  it("appends unknown string sections in sentence case after known ones", () => {
    const sections = parseProposalSections({
      expected_roi: "3x",
      executive_summary: "Summary",
      recommended_add_ons: ["Training"],
    });
    expect(sections.map((s) => [s.key, s.title])).toEqual([
      ["executive_summary", "Executive summary"],
      ["expected_roi", "Expected roi"],
      ["recommended_add_ons", "Recommended add ons"],
    ]);
  });

  it("skips title, pricing, objects, numbers and empty values", () => {
    const sections = parseProposalSections({
      title: "Proposal title",
      pricing: [{ tier: "Good", price: "$1", features: [] }],
      key_findings: [{ area: "SEO", score: 40 }],
      meta: { a: 1 },
      score: 7,
      timeline: "",
      deliverables: [],
      terms: "   ",
      next_steps: ["ok", 3],
    });
    expect(sections).toEqual([]);
  });
});

describe("parsePricingTiers", () => {
  it("reads the seed's object map in insertion order and formats numeric prices", () => {
    const tiers = parsePricingTiers({
      good: { name: "Starter", price: 99, features: ["5 users"] },
      better: { name: "Professional", price: 1249, features: ["25 users", 7] },
      best: { name: "Enterprise", price: 499, features: ["Unlimited"] },
    });
    expect(tiers).toEqual([
      { name: "Starter", price: "$99/mo", features: ["5 users"], recommended: false },
      { name: "Professional", price: "$1,249/mo", features: ["25 users"], recommended: false },
      { name: "Enterprise", price: "$499/mo", features: ["Unlimited"], recommended: false },
    ]);
  });

  it("orders a jsonb-reordered object map as good, better, best", () => {
    const tiers = parsePricingTiers({
      best: { name: "Enterprise", price: 499, features: [] },
      good: { name: "Starter", price: 99, features: [] },
      better: { name: "Professional", price: 1249, features: [] },
    });
    expect(tiers.map((t) => t.name)).toEqual(["Starter", "Professional", "Enterprise"]);
  });

  it("reads { tiers: [...] } from the AI pricing generator", () => {
    const tiers = parsePricingTiers({
      tiers: [
        { name: "Starter", price: "$499/mo", features: ["A"], recommended: false },
        { name: "Pro", price: "$999/mo", features: ["B"], recommended: true },
      ],
      reasoning: "because",
    });
    expect(tiers).toEqual([
      { name: "Starter", price: "$499/mo", features: ["A"], recommended: false },
      { name: "Pro", price: "$999/mo", features: ["B"], recommended: true },
    ]);
  });

  it("reads a plain array and uses tier when name is missing", () => {
    const tiers = parsePricingTiers([{ tier: "Good", price: "$10", features: "nope", recommended: "yes" }]);
    expect(tiers).toEqual([{ name: "Good", price: "$10", features: [], recommended: false }]);
  });

  it("drops entries without a name and non-object entries", () => {
    const tiers = parsePricingTiers([{ price: 5 }, "x", null, { name: "", price: 1 }, { name: "Ok" }]);
    expect(tiers).toEqual([{ name: "Ok", price: "", features: [], recommended: false }]);
  });

  it("falls back to content.pricing when pricingTiers yields nothing", () => {
    const content = { pricing: [{ tier: "Better", price: "$200", features: ["X"] }] };
    expect(parsePricingTiers([], content)).toEqual([
      { name: "Better", price: "$200", features: ["X"], recommended: false },
    ]);
    expect(parsePricingTiers({}, content)).toHaveLength(1);
    expect(parsePricingTiers(null, content)).toHaveLength(1);
  });

  it("prefers pricingTiers over content.pricing", () => {
    const content = { pricing: [{ tier: "Fallback", price: "$1", features: [] }] };
    expect(parsePricingTiers([{ name: "Main" }], content).map((t) => t.name)).toEqual(["Main"]);
  });

  it("returns [] when nothing is usable", () => {
    expect(parsePricingTiers(undefined)).toEqual([]);
    expect(parsePricingTiers("x", { pricing: "nope" })).toEqual([]);
    expect(parsePricingTiers({}, null)).toEqual([]);
  });
});
