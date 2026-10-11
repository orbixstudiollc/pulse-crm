import { beforeEach, describe, expect, it, vi } from "vitest";
import { TwentyClient, supportsTwentyCas, type TwentySchema } from "@/lib/twenty/client";
import { validateTwentyPatch } from "@/lib/twenty/metadata";
import type { TwentyConnection } from "@/lib/twenty/types";

const mcp = vi.hoisted(() => ({ sendResponse: null as unknown, calls: [] as Record<string, unknown>[] }));
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({ Client: class {
  async connect() {}
  async close() {}
  async callTool(call: { name: string; arguments?: { toolName?: string } }) {
    mcp.calls.push(call);
    if (call.name === "get_tool_catalog") return { content: [{ type: "text", text: "find_connected_accounts send_email" }] };
    if (call.name === "learn_tools") return { content: [{ type: "text", text: "{}" }] };
    const payload = call.arguments?.toolName === "find_connected_accounts"
      ? { success: true, result: { records: [{ id: "11111111-1111-4111-8111-111111111111", handle: "sender@example.com" }] } }
      : mcp.sendResponse;
    return { content: [{ type: "text", text: JSON.stringify(payload) }] };
  }
} }));
beforeEach(() => { mcp.calls = []; mcp.sendResponse = { success: true, result: { headerMessageId: "<delivered@example.com>" } }; });

const id = "11111111-1111-4111-8111-111111111111";
const updatedAt = "2026-10-11T00:00:00.000Z";
const scalar = (name: string) => ({ kind: "SCALAR", name });
const input = (name: string) => ({ kind: "INPUT_OBJECT", name });
const connection: TwentyConnection = { id: "c", organization_id: "org", owner_id: "user", workspace_url: "https://orbix-sales.twenty.com", workspace_id: "w", revision: 1, status: "verified", cas_verified: true, writes_enabled: true, monthly_token_cap: null, verified_at: updatedAt, apiKey: "crm-secret", cutover_audit: { reviewedAt: updatedAt, reviewedBy: "user", coveredObjects: ["person", "company", "mailbox"], nativeTriggers: [], verifiedNoUnexpectedEffects: true, coverageEvidence: "Complete native hooks inspected", conditionalUpdateEvidence: { recordId: id, returnedOne: true, staleRejected: true, evidence: "Recorded fresh/stale probe" } } };
const schema: TwentySchema = { queryType: { name: "Query" }, mutationType: { name: "Mutation" }, types: [
  { name: "Query", kind: "OBJECT", fields: ["people", "companies"].map(name => ({ name, type: { kind: "OBJECT", name: "Connection" }, args: [{ name: "first", type: scalar("Int") }, { name: "after", type: scalar("String") }, { name: "filter", type: input("RecordFilter") }, { name: "orderBy", type: input("RecordOrder") }] })) },
  { name: "Mutation", kind: "OBJECT", fields: ["updatePeople", "createPerson"].map(name => ({ name, type: { kind: "LIST", name: null, ofType: { kind: "OBJECT", name: "Person" } }, args: [{ name: "filter", type: input("RecordFilter") }, { name: "data", type: input("PersonInput") }] })) },
  { name: "RecordFilter", kind: "INPUT_OBJECT", inputFields: [{ name: "id", type: input("ScalarFilter") }, { name: "updatedAt", type: input("ScalarFilter") }] },
  { name: "ScalarFilter", kind: "INPUT_OBJECT", inputFields: [{ name: "eq", type: scalar("String") }] },
  { name: "Person", kind: "OBJECT", fields: [{ name: "id", type: scalar("UUID") }, { name: "updatedAt", type: scalar("DateTime") }, { name: "leadScore", type: scalar("Float") }, { name: "credentialCiphertext", type: scalar("String") }, { name: "emails", type: { kind: "OBJECT", name: "Emails" } }] },
  { name: "Company", kind: "OBJECT", fields: [{ name: "id", type: scalar("UUID") }, { name: "updatedAt", type: scalar("DateTime") }, { name: "name", type: scalar("String") }] },
  { name: "Emails", kind: "OBJECT", fields: [{ name: "primaryEmail", type: scalar("String") }, { name: "credentialCiphertext", type: scalar("String") }] },
] };
function mockFetch(result: unknown, status = 200) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    if (payload.query.includes("__schema")) return new Response(JSON.stringify({ data: { __schema: schema } }));
    return new Response(JSON.stringify(result), { status });
  }) as unknown as typeof fetch;
}
describe("Twenty bounded API adapter", () => {
  it("only accepts sales objects, explicit relation IDs, and allowlisted fields", async () => {
    expect(() => validateTwentyPatch("person", { credentialCiphertext: "secret" })).toThrow("not writable");
    expect(() => validateTwentyPatch("person", { companyId: { create: { name: "nested" } } })).toThrow("explicit record ID");
    expect(() => validateTwentyPatch("company", { name: { connect: { id } } })).toThrow("Nested");
    const request = mockFetch({});
    await expect(new TwentyClient(connection, request).list("payroll" as never)).rejects.toThrow("not allowed"); expect(request).not.toHaveBeenCalled();
  });
  it("detects whether the deployed mutation supports id and version equality", () => {
    expect(supportsTwentyCas(schema, "person")).toBe(true);
    const withoutVersion = structuredClone(schema); withoutVersion.types.find(type => type.name === "RecordFilter")!.inputFields = [{ name: "id", type: input("ScalarFilter") }];
    expect(supportsTwentyCas(withoutVersion, "person")).toBe(false);
  });
  it("sends one conditional mutation and requires exactly one matching result", async () => {
    const request = mockFetch({ data: { updatePeople: [{ id, updatedAt, leadScore: 75 }] } });
    await expect(new TwentyClient(connection, request).update("person", id, updatedAt, { leadScore: 75 })).resolves.toMatchObject({ id });
    const call = JSON.parse(String(vi.mocked(request).mock.calls[1][1]?.body));
    expect(call.variables.filter).toEqual({ id: { eq: id }, updatedAt: { eq: updatedAt } });
    expect(call.query).not.toContain("credentialCiphertext"); expect(call.query).toContain("emails { primaryEmail }");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("treats zero updates as stale and ambiguous results as reconciliation", async () => {
    await expect(new TwentyClient(connection, mockFetch({ data: { updatePeople: [] } })).update("person", id, updatedAt, { leadScore: 75 })).rejects.toMatchObject({ code: "record_changed", outcome: undefined });
    await expect(new TwentyClient(connection, mockFetch({ data: { updatePeople: [{ id }, { id }] } })).update("person", id, updatedAt, { leadScore: 75 })).rejects.toMatchObject({ outcome: "unknown_outcome" });
  });
  it("never sends a mutation before cutover authorization", async () => {
    const request = mockFetch({});
    await expect(new TwentyClient({ ...connection, writes_enabled: false }, request).update("person", id, updatedAt, { leadScore: 1 })).rejects.toThrow("disabled"); expect(request).not.toHaveBeenCalled();
  });
  it("does not retry a timed-out or server-failed mutation", async () => {
    const request = mockFetch({}, 500);
    await expect(new TwentyClient(connection, request).create("person", { leadScore: 1 })).rejects.toMatchObject({ outcome: "unknown_outcome" });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("preserves cursor and inclusive timestamp filters when polling", async () => {
    const request = mockFetch({ data: { people: { edges: [{ node: { id, updatedAt } }], pageInfo: { endCursor: "next", hasNextPage: true } } } });
    expect(await new TwentyClient(connection, request).list("person", { updatedAfter: updatedAt, after: "current", limit: 50 })).toEqual({ records: [{ id, updatedAt }], endCursor: "next", hasNextPage: true });
    const call = JSON.parse(String(vi.mocked(request).mock.calls[1][1]?.body)); expect(call.variables.after).toBe("current"); expect(call.variables.filter.updatedAt).toEqual({ gte: updatedAt });
  });
  it("rejects private field filters and nested mutation operations before requesting records", async () => {
    await expect(new TwentyClient(connection, mockFetch({})).list("person", { filter: { credentialCiphertext: { eq: "value" } } })).rejects.toThrow("not allowed");
    await expect(new TwentyClient(connection, mockFetch({})).list("person", { filter: { emails: { connect: { eq: "bad" } } } })).rejects.toThrow("not allowed");
  });
  it("keeps known API rejection separate from unknown mutation outcomes", async () => {
    await expect(new TwentyClient(connection, mockFetch({}, 429)).create("person", { leadScore: 1 })).rejects.toMatchObject({ code: "request_rejected", outcome: undefined });
  });
  it("rejects email header injection before contacting a mailbox", async () => {
    const request = mockFetch({});
    await expect(new TwentyClient(connection, request).sendEmail({ connectedAccountId: id, fromHandle: "sender@example.com", recipients: ["to@example.com"], subject: "subject\r\nBcc: injected@example.com", body: "body" })).rejects.toThrow("Invalid email"); expect(request).not.toHaveBeenCalled();
  });
  it.each([{}, null, "unexpected", { success: true, result: {} }, { success: true, result: { headerMessageId: "" } }])("preserves an unconfirmed send result as unknown: %j", async (response) => {
    mcp.sendResponse = response;
    await expect(new TwentyClient(connection, mockFetch({})).sendEmail({ connectedAccountId: id, fromHandle: "sender@example.com", recipients: ["to@example.com"], subject: "Reviewed subject", body: "Reviewed body" })).rejects.toMatchObject({ outcome: "unknown_outcome" });
    expect(mcp.calls.filter((call) => (call.arguments as { toolName?: string })?.toolName === "send_email")).toHaveLength(1);
  });
  it("retains delivery evidence when Twenty did not return a persisted message ID", async () => {
    await expect(new TwentyClient(connection, mockFetch({})).sendEmail({ connectedAccountId: id, fromHandle: "sender@example.com", recipients: ["to@example.com"], subject: "Reviewed subject", body: "Reviewed body" })).resolves.toEqual({ sent: true, headerMessageId: "<delivered@example.com>" });
  });
});
