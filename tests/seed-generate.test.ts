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
});
