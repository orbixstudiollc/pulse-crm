// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(__dirname, "../lib/actions/copilot.ts"), "utf8");
const statements = source.split(";");
const SCOPE = /organization_id|conversation_id/;

describe("copilot actions org scoping", () => {
  const mutations = statements.filter((s) => /\.(update|delete)\(/.test(s));

  it("finds the update and delete calls", () => {
    expect(mutations.length).toBeGreaterThanOrEqual(6);
  });

  it("scopes every update/delete chain by organization_id or conversation_id", () => {
    const unscoped = mutations.filter((s) => !SCOPE.test(s)).map((s) => s.trim());
    expect(unscoped).toEqual([]);
  });

  it("scopes every update/delete chain by organization_id", () => {
    const unscoped = mutations
      .filter((s) => !/\.eq\("organization_id", orgId\)/.test(s))
      .map((s) => s.trim());
    expect(unscoped).toEqual([]);
  });
});
