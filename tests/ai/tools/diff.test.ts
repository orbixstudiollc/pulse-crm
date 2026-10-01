import { describe, expect, it } from "vitest";
import { computeFieldDiff, isDiffStale } from "@/lib/ai/tools/diff";

const base = { toolName: "update_lead", recordType: "lead" };

describe("computeFieldDiff", () => {
  it("lists every non-id field for a create diff", () => {
    const diff = computeFieldDiff({
      ...base,
      toolName: "create_lead",
      input: { id: "x1", name: "Acme", status: "hot", notes: null },
      current: null,
    });
    expect(diff.kind).toBe("create");
    expect(diff.recordId).toBeUndefined();
    expect(diff.fields).toEqual([
      { name: "name", after: "Acme" },
      { name: "status", after: "hot" },
      { name: "notes", after: null },
    ]);
  });

  it("omits the custom id field on create", () => {
    const diff = computeFieldDiff({
      ...base,
      input: { lead_id: "x1", name: "Acme" },
      current: null,
      idField: "lead_id",
    });
    expect(diff.fields.map((f) => f.name)).toEqual(["name"]);
  });

  it("omits unchanged keys from an update diff and records before/after", () => {
    const diff = computeFieldDiff({
      ...base,
      input: { name: "Acme", status: "hot", notes: "" },
      current: { id: "l1", name: "Acme", status: "cold", notes: "", updated_at: "2026-09-30T10:00:00Z" },
    });
    expect(diff.kind).toBe("update");
    expect(diff.recordId).toBe("l1");
    expect(diff.baselineUpdatedAt).toBe("2026-09-30T10:00:00Z");
    expect(diff.fields).toEqual([{ name: "status", before: "cold", after: "hot" }]);
  });

  it("treats '2026-10-01T00:00:00Z' and '2026-10-01' as equal", () => {
    const diff = computeFieldDiff({
      ...base,
      input: { next_followup: "2026-10-01", name: "B" },
      current: { id: "l1", next_followup: "2026-10-01T00:00:00Z", name: "A" },
    });
    expect(diff.fields.map((f) => f.name)).toEqual(["name"]);
  });

  it("treats null and undefined as equal but null vs a value as different", () => {
    const diff = computeFieldDiff({
      ...base,
      input: { phone: null, email: undefined, company: "X" },
      current: { id: "l1", phone: undefined, email: null, company: null },
    });
    expect(diff.fields).toEqual([{ name: "company", before: null, after: "X" }]);
  });

  it("never lists the id field in an update diff", () => {
    const diff = computeFieldDiff({
      ...base,
      input: { id: "l2", name: "A" },
      current: { id: "l1", name: "B" },
    });
    expect(diff.fields.map((f) => f.name)).toEqual(["name"]);
    expect(diff.recordId).toBe("l1");
  });
});

describe("isDiffStale", () => {
  const diff = computeFieldDiff({
    ...base,
    input: { status: "hot" },
    current: { id: "l1", status: "cold", name: "Acme" },
  });

  it("is not stale when live still matches the before values", () => {
    expect(isDiffStale(diff, { id: "l1", status: "cold", name: "Acme" })).toBe(false);
  });

  it("is stale when a diffed column changed in live", () => {
    expect(isDiffStale(diff, { id: "l1", status: "warm", name: "Acme" })).toBe(true);
  });

  it("is stale when the live record is gone", () => {
    expect(isDiffStale(diff, null)).toBe(true);
  });

  it("is not stale when only a non-diffed column changed", () => {
    expect(isDiffStale(diff, { id: "l1", status: "cold", name: "Renamed" })).toBe(false);
  });

  it("compares dates by day when checking staleness", () => {
    const d = computeFieldDiff({
      ...base,
      input: { next_followup: "2026-11-01" },
      current: { id: "l1", next_followup: "2026-10-01T00:00:00Z" },
    });
    expect(isDiffStale(d, { next_followup: "2026-10-01" })).toBe(false);
    expect(isDiffStale(d, { next_followup: "2026-10-02" })).toBe(true);
  });

  it("never marks a create diff stale", () => {
    const create = computeFieldDiff({ ...base, input: { name: "A" }, current: null });
    expect(isDiffStale(create, null)).toBe(false);
  });
});
