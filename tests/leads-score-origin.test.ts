import { beforeEach, describe, expect, it, vi } from "vitest";

const evaluate = vi.fn(async () => ({ skipped: [] as string[] }));
vi.mock("@/lib/automation/runner", () => ({ evaluateLeadAgainstRules: evaluate }));

import { scoreLead } from "@/lib/leads/score";

const ORG = "00000000-0000-4000-8000-000000000001";
const LEAD = "00000000-0000-4000-8000-000000000002";

/** Chainable fake: every query resolves to a lead-shaped row, a count of 0, or a scoring profile. */
function fakeDb() {
  const make = (table: string) => {
    const result = () => {
      if (table === "scoring_profiles") return { data: { id: "p", weights: null, organization_id: ORG }, error: null };
      if (table === "leads") return { data: { id: LEAD, organization_id: ORG, score: 10, status: "cold" }, error: null };
      return { data: [], error: null, count: 0 };
    };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "insert", "update", "order", "limit"]) q[m] = () => q;
    q.single = async () => result();
    q.maybeSingle = async () => result();
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
    return q;
  };
  return { from: (table: string) => make(table) };
}

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("scoreLead automation origin", () => {
  beforeEach(() => evaluate.mockClear());

  it("passes origin copilot to the score_changed automations", async () => {
    // @ts-expect-error minimal fake client
    await scoreLead(fakeDb(), ORG, LEAD, { origin: "copilot" });
    await flush();
    expect(evaluate).toHaveBeenCalledWith(LEAD, "score_changed", expect.any(Object), { origin: "copilot" });
  });

  it("keeps the unrestricted call when no origin is given", async () => {
    // @ts-expect-error minimal fake client
    await scoreLead(fakeDb(), ORG, LEAD);
    await flush();
    expect(evaluate).toHaveBeenCalledWith(LEAD, "score_changed", expect.any(Object), {});
  });
});
