import { describe, it, expect } from "vitest";
import { resolvePage, PAGE_MAP } from "@/lib/ai/page-map";
import { startersFor } from "@/lib/ai/page-starters";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe("resolvePage", () => {
  it("resolves an inbox thread to the inbox page with the thread id", () => {
    expect(resolvePage(`/dashboard/inbox/${UUID}`)).toEqual({
      pageKey: "inbox",
      label: "Inbox",
      entityType: "thread",
      entityId: UUID,
    });
  });

  it("resolves the inbox list without an entity", () => {
    expect(resolvePage("/dashboard/inbox")).toEqual({ pageKey: "inbox", label: "Inbox" });
  });

  it("maps /dashboard/sales to deals", () => {
    expect(resolvePage("/dashboard/sales")).toMatchObject({ pageKey: "deals" });
    expect(PAGE_MAP["/dashboard/sales"].pageKey).toBe("deals");
  });

  it("captures lead and deal ids from detail paths", () => {
    expect(resolvePage(`/dashboard/leads/${UUID}`)).toMatchObject({
      pageKey: "lead_detail",
      entityType: "lead",
      entityId: UUID,
    });
    expect(resolvePage(`/dashboard/sales/${UUID}`)).toMatchObject({
      entityType: "deal",
      entityId: UUID,
    });
  });

  it("does not treat a non-uuid segment as an entity id", () => {
    const r = resolvePage("/dashboard/leads/add");
    expect(r.entityId).toBeUndefined();
    expect(r.pageKey).toBe("leads");
  });

  it("returns 'other' for unknown paths", () => {
    expect(resolvePage("/somewhere/else").pageKey).toBe("other");
    expect(resolvePage("/dashboard/nope").pageKey).toBe("other");
  });
});

describe("startersFor", () => {
  it("leads without selection excludes the two selection-only chips", () => {
    const labels = startersFor("leads", { count: 0 }).map((s) => s.label);
    expect(labels).toEqual(["Find hot leads with no follow-up"]);
    expect(labels).not.toContain("Find leads like these");
    expect(labels).not.toContain("Score these");
  });

  it("leads with a selection includes all three chips", () => {
    const labels = startersFor("leads", { count: 3 }).map((s) => s.label);
    expect(labels).toEqual([
      "Find leads like these",
      "Score these",
      "Find hot leads with no follow-up",
    ]);
  });

  it("returns the specified chips for other pages", () => {
    expect(startersFor("lead_detail", { count: 0 }).map((s) => s.label)).toEqual([
      "Summarize",
      "Draft follow-up",
    ]);
    expect(startersFor("deals", { count: 0 }).map((s) => s.label)).toEqual([
      "Which deals are at risk?",
      "Move stale deals",
    ]);
    expect(startersFor("inbox", { count: 0 }).map((s) => s.label)).toEqual([
      "Draft a reply",
      "Summarize thread",
    ]);
    expect(startersFor("other", { count: 0 })).toEqual([]);
  });

  it("selection-based prompts refer to the selected records", () => {
    const [like, score] = startersFor("leads", { count: 2 });
    expect(like.prompt).toContain("the selected records");
    expect(score.prompt).toContain("the selected records");
  });

  it("no starter prompt contains a uuid", () => {
    for (const key of ["leads", "lead_detail", "deals", "inbox", "other"]) {
      for (const count of [0, 5]) {
        for (const s of startersFor(key, { count })) {
          expect(s.prompt).not.toMatch(UUID_RE);
        }
      }
    }
  });
});
