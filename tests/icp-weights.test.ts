// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_ICP_WEIGHTS, normalizeWeights } from "@/lib/icp/weights";

const sum = (w: Record<string, number>) => Object.values(w).reduce((s, v) => s + v, 0);

describe("normalizeWeights", () => {
  it("returns the default weights when the input is null, undefined or empty", () => {
    expect(normalizeWeights(null)).toEqual(DEFAULT_ICP_WEIGHTS);
    expect(normalizeWeights(undefined)).toEqual(DEFAULT_ICP_WEIGHTS);
    expect(normalizeWeights({})).toEqual(DEFAULT_ICP_WEIGHTS);
  });

  it("uses the documented default", () => {
    expect(DEFAULT_ICP_WEIGHTS).toEqual({
      industry: 25, size: 20, revenue: 15, title: 15, geography: 15, tech: 10,
    });
  });

  it("returns the default weights when every value is zero or invalid", () => {
    expect(
      normalizeWeights({ industry: 0, size: 0, revenue: 0, title: 0, geography: 0, tech: 0 }),
    ).toEqual(DEFAULT_ICP_WEIGHTS);
    expect(normalizeWeights({ industry: -10, size: Number.NaN, tech: Infinity })).toEqual(
      DEFAULT_ICP_WEIGHTS,
    );
  });

  it("keeps weights that already total 100", () => {
    const w = { industry: 30, size: 20, revenue: 10, title: 20, geography: 10, tech: 10 };
    expect(normalizeWeights(w)).toEqual(w);
  });

  it("scales weights that do not total 100", () => {
    expect(normalizeWeights({ industry: 5, size: 5 })).toEqual({
      industry: 50, size: 50, revenue: 0, title: 0, geography: 0, tech: 0,
    });
  });

  it("reaches exactly 100 where per-value rounding would give 99", () => {
    // Math.round gives 33 + 33 + 33 = 99
    const w = normalizeWeights({ industry: 1, size: 1, revenue: 1 });
    expect(sum(w)).toBe(100);
    expect(w).toEqual({ industry: 34, size: 33, revenue: 33, title: 0, geography: 0, tech: 0 });
  });

  it("reaches exactly 100 where per-value rounding would give 102", () => {
    // Math.round gives 17 * 6 = 102
    const w = normalizeWeights({ industry: 1, size: 1, revenue: 1, title: 1, geography: 1, tech: 1 });
    expect(sum(w)).toBe(100);
    expect(w).toEqual({ industry: 17, size: 17, revenue: 17, title: 17, geography: 16, tech: 16 });
  });

  it("gives the leftover points to the largest remainders", () => {
    // 2:1 scales to 66.67 / 33.33
    expect(normalizeWeights({ industry: 2, tech: 1 })).toEqual({
      industry: 67, size: 0, revenue: 0, title: 0, geography: 0, tech: 33,
    });
  });

  it("treats negative and non-finite values as 0", () => {
    expect(
      normalizeWeights({ industry: 40, size: -20, revenue: Number.NaN, title: Infinity, geography: 40, tech: 20 }),
    ).toEqual({ industry: 40, size: 0, revenue: 0, title: 0, geography: 40, tech: 20 });
  });

  it("always returns non-negative integers totalling 100", () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 500; i++) {
      const w = normalizeWeights({
        industry: rand() * 90, size: rand() * 90, revenue: rand() * 90,
        title: rand() * 90, geography: rand() * 90, tech: rand() * 90,
      });
      expect(sum(w)).toBe(100);
      for (const v of Object.values(w)) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
