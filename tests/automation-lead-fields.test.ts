// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isAllowedLeadField } from "@/lib/automation/lead-fields";

describe("isAllowedLeadField", () => {
  it("accepts allowlisted lead columns", () => {
    expect(isAllowedLeadField("status")).toBe(true);
    expect(isAllowedLeadField("tags")).toBe(true);
  });

  it("rejects identity, tenancy, ownership and contact columns", () => {
    expect(isAllowedLeadField("organization_id")).toBe(false);
    expect(isAllowedLeadField("id")).toBe(false);
    expect(isAllowedLeadField("assigned_to")).toBe(false);
    expect(isAllowedLeadField("email")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isAllowedLeadField(42)).toBe(false);
    expect(isAllowedLeadField(null)).toBe(false);
  });
});
