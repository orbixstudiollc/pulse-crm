// @vitest-environment node
import { describe, expect, it } from "vitest";
import { pickSortColumn } from "@/lib/security";

const SORTABLE = ["created_at", "name", "score"] as const;

describe("pickSortColumn", () => {
  it("returns the raw value when it is in the allowlist", () => {
    expect(pickSortColumn("name", SORTABLE, "created_at")).toBe("name");
  });

  it("returns the fallback for an injection attempt", () => {
    expect(pickSortColumn("id; drop table", SORTABLE, "created_at")).toBe("created_at");
  });

  it("returns the fallback for null", () => {
    expect(pickSortColumn(null, SORTABLE, "created_at")).toBe("created_at");
  });

  it("returns the fallback for undefined", () => {
    expect(pickSortColumn(undefined, SORTABLE, "created_at")).toBe("created_at");
  });
});
