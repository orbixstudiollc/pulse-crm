// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACTOR_REGISTRY } from "@/lib/lead-finder/apify/registry";
import { evaluateActorPolicy } from "@/lib/lead-finder/apify/policy";

const BUILTIN = ACTOR_REGISTRY[0].id;
const CUSTOM = "someone/custom-actor";

describe("evaluateActorPolicy", () => {
  it("allows a built-in actor under platform and tenant credentials", () => {
    expect(evaluateActorPolicy([BUILTIN], "platform")).toEqual({ allowed: true, blocked: [] });
    expect(evaluateActorPolicy([BUILTIN], "tenant")).toEqual({ allowed: true, blocked: [] });
  });

  it("allows the ~ form of a built-in actor", () => {
    expect(evaluateActorPolicy([BUILTIN.replace("/", "~")], "platform").allowed).toBe(true);
  });

  it("blocks a custom actor on the platform key and allows it on a tenant key", () => {
    expect(evaluateActorPolicy([CUSTOM], "platform")).toEqual({ allowed: false, blocked: [CUSTOM] });
    expect(evaluateActorPolicy([CUSTOM], "tenant")).toEqual({ allowed: true, blocked: [] });
  });

  it("reports only the custom id in a mixed list", () => {
    expect(evaluateActorPolicy([BUILTIN, CUSTOM], "platform")).toEqual({
      allowed: false,
      blocked: [CUSTOM],
    });
  });

  it("allows an empty list", () => {
    expect(evaluateActorPolicy([], "platform")).toEqual({ allowed: true, blocked: [] });
  });

  it.each(["../../evil", "nope", "a/b/c"])("blocks malformed id %s under both sources", (id) => {
    expect(evaluateActorPolicy([id], "platform")).toEqual({ allowed: false, blocked: [id] });
    expect(evaluateActorPolicy([id], "tenant")).toEqual({ allowed: false, blocked: [id] });
  });
});
