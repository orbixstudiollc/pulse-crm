// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LEAD_SOURCES, normalizeLeadSource } from "@/lib/leads/source";

describe("normalizeLeadSource", () => {
  it("keeps enum values as they are", () => {
    for (const s of LEAD_SOURCES) expect(normalizeLeadSource(s)).toBe(s);
  });

  it("maps the lowercase and kebab-case values older forms sent", () => {
    expect(normalizeLeadSource("referral")).toBe("Referral");
    expect(normalizeLeadSource("linkedin")).toBe("LinkedIn");
    expect(normalizeLeadSource("google-ads")).toBe("Google Ads");
    expect(normalizeLeadSource("cold_call")).toBe("Cold Call");
    expect(normalizeLeadSource(" EVENT ")).toBe("Event");
  });

  it("returns null for an empty source", () => {
    expect(normalizeLeadSource("")).toBeNull();
    expect(normalizeLeadSource("   ")).toBeNull();
    expect(normalizeLeadSource(null)).toBeNull();
    expect(normalizeLeadSource(undefined)).toBeNull();
  });

  it("returns undefined for a source the enum doesn't have", () => {
    expect(normalizeLeadSource("cold-outreach")).toBeUndefined();
    expect(normalizeLeadSource("Trade Show")).toBeUndefined();
    expect(normalizeLeadSource(42)).toBeUndefined();
  });
});
