import { describe, expect, it } from "vitest";
import { PROFILE_UPDATABLE_FIELDS, pickProfileUpdates } from "@/lib/profile/allowlist";

describe("pickProfileUpdates", () => {
  it("keeps every allowlisted key", () => {
    const input = Object.fromEntries(PROFILE_UPDATABLE_FIELDS.map((f) => [f, `v-${f}`]));
    expect(pickProfileUpdates(input)).toEqual(input);
  });

  it("drops organization_id and role when mixed with first_name", () => {
    const out = pickProfileUpdates({ first_name: "Ada", organization_id: "other-org", role: "admin" });
    expect(out).toEqual({ first_name: "Ada" });
    expect(out).not.toHaveProperty("organization_id");
    expect(out).not.toHaveProperty("role");
  });

  it("drops unknown keys", () => {
    expect(pickProfileUpdates({ last_name: "Lovelace", foo: 1, is_admin: true })).toEqual({
      last_name: "Lovelace",
    });
  });

  it("returns an empty object when only forbidden keys are given", () => {
    expect(pickProfileUpdates({ "organization_id": "x", role: "admin" })).toEqual({});
  });

  it("drops undefined-valued keys", () => {
    expect(pickProfileUpdates({ first_name: undefined, phone: "123", timezone: undefined })).toEqual({
      phone: "123",
    });
  });

  it("does not mutate the input", () => {
    const input = { first_name: "Ada", role: "admin", notification_preferences: { email: true } };
    const before = structuredClone(input);
    const out = pickProfileUpdates(input);
    expect(input).toEqual(before);
    expect(out).not.toBe(input);
  });
});
