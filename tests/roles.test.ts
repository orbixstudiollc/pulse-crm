// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, hasRequiredRole } from "@/lib/auth/roles";

describe("hasRequiredRole", () => {
  it("allows admin and owner by default", () => {
    expect(ADMIN_ROLES).toEqual(["admin", "owner"]);
    expect(hasRequiredRole("admin")).toBe(true);
    expect(hasRequiredRole("owner")).toBe(true);
  });

  it("rejects member, missing roles and wrong casing", () => {
    expect(hasRequiredRole("member")).toBe(false);
    expect(hasRequiredRole(null)).toBe(false);
    expect(hasRequiredRole(undefined)).toBe(false);
    expect(hasRequiredRole("")).toBe(false);
    expect(hasRequiredRole("Admin")).toBe(false);
  });

  it("honours a custom allowed list", () => {
    expect(hasRequiredRole("member", ["member"])).toBe(true);
    expect(hasRequiredRole("admin", ["owner"])).toBe(false);
    expect(hasRequiredRole("owner", ["owner"])).toBe(true);
  });
});
