// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { FakeSupabase } from "./helpers/fake-supabase";
import { generateApiKey, hashApiKey } from "@/lib/mcp/api-keys";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "33333333-3333-4333-8333-333333333333";
const LEAD_A = "44444444-4444-4444-8444-444444444444";
const LEAD_B = "55555555-5555-4555-8555-555555555555";
const DEAL_A = "66666666-6666-4666-8666-666666666666";

let db: FakeSupabase;
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => db }));
vi.mock("@/lib/automation/runner", () => ({ evaluateLeadAgainstRules: vi.fn(async () => undefined) }));

const writeKey = generateApiKey();
const readKey = generateApiKey();
const revokedKey = generateApiKey();

function seed() {
  return new FakeSupabase({
    organizations: [{ id: ORG_A, name: "Acme Agency" }, { id: ORG_B, name: "Other Co" }],
    profiles: [{ id: USER_A, first_name: "John", last_name: "Harris", email: "john@example.com" }],
    api_keys: [
      { id: "k1", organization_id: ORG_A, key_hash: writeKey.hash, scope: "write", created_by: USER_A, revoked_at: null, last_used_at: null },
      { id: "k2", organization_id: ORG_A, key_hash: readKey.hash, scope: "read", created_by: USER_A, revoked_at: null, last_used_at: null },
      { id: "k3", organization_id: ORG_A, key_hash: revokedKey.hash, scope: "write", created_by: USER_A, revoked_at: "2026-01-01T00:00:00Z", last_used_at: null },
    ],
    leads: [
      { id: LEAD_A, organization_id: ORG_A, name: "Jane Doe", email: "jane@acme.test", company: "Acme", status: "hot", next_followup: "2020-01-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z" },
      { id: LEAD_B, organization_id: ORG_B, name: "Jane Other", email: "jane@other.test", company: "Other", status: "hot", created_at: "2026-09-02T00:00:00Z" },
    ],
    deals: [
      { id: DEAL_A, organization_id: ORG_A, name: "Acme retainer", value: 10000, probability: 50, stage: "proposal", stage_changed_at: "2026-09-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z", close_date: null },
    ],
    contacts: [],
    customers: [],
    activities: [],
  });
}

async function connect(key: string) {
  const { POST } = await import("@/app/api/mcp/route");
  const client = new Client({ name: "test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
    fetch: (url, init) => POST(new Request(url, init)),
  });
  await client.connect(transport);
  return client;
}

function parse(result: Awaited<ReturnType<Client["callTool"]>>) {
  const content = result.content as { type: string; text: string }[];
  return JSON.parse(content[0].text);
}

describe("MCP route", () => {
  beforeEach(() => { db = seed(); });
  afterEach(() => vi.clearAllMocks());

  it("rejects missing, malformed and revoked keys with 401", async () => {
    const { POST } = await import("@/app/api/mcp/route");
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    for (const auth of [undefined, "Bearer nope", `Bearer ${revokedKey.key}`, `Bearer ${generateApiKey().key}`]) {
      const res = await POST(new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
        body,
      }));
      expect(res.status).toBe(401);
    }
  });

  it("gives read keys only read tools and write keys everything", async () => {
    const reader = await connect(readKey.key);
    const readTools = (await reader.listTools()).tools.map((t) => t.name);
    expect(readTools).toContain("search_deals");
    expect(readTools).not.toContain("create_deal");
    expect(readTools.every((n) => !/^(create|update|delete|add|set|convert)_/.test(n))).toBe(true);

    const writer = await connect(writeKey.key);
    const writeTools = (await writer.listTools()).tools.map((t) => t.name);
    expect(writeTools).toEqual(expect.arrayContaining(["create_deal", "update_deal", "delete_record", "add_note"]));
  });

  it("only returns the key's own workspace", async () => {
    const client = await connect(readKey.key);
    const leads = parse(await client.callTool({ name: "search_leads", arguments: { search: "jane" } }));
    expect(leads.total).toBe(1);
    expect(leads.leads[0].id).toBe(LEAD_A);

    const other = await client.callTool({ name: "get_lead", arguments: { id: LEAD_B } });
    expect(other.isError).toBe(true);

    const summary = parse(await client.callTool({ name: "get_workspace_summary", arguments: {} }));
    expect(summary.workspace).toBe("Acme Agency");
    expect(summary.counts.leads).toBe(1);
    expect(summary.counts.overdue_followups).toBe(1);
    expect(summary.pipeline.proposal).toEqual({ count: 1, value: 10000, weighted_value: 5000 });
  });

  it("cannot update or delete another workspace's records", async () => {
    const client = await connect(writeKey.key);
    const upd = await client.callTool({ name: "update_lead", arguments: { id: LEAD_B, status: "cold" } });
    expect(upd.isError).toBe(true);
    const del = await client.callTool({ name: "delete_record", arguments: { record_type: "lead", id: LEAD_B } });
    expect(del.isError).toBe(true);
    expect(db.tables.leads.find((l) => l.id === LEAD_B)?.status).toBe("hot");

    const note = await client.callTool({ name: "add_note", arguments: { record_type: "lead", record_id: LEAD_B, content: "x" } });
    expect(note.isError).toBe(true);
  });

  it("creates records in the key's workspace and restarts the stage clock on a stage change", async () => {
    const client = await connect(writeKey.key);
    const created = parse(await client.callTool({
      name: "create_activity",
      arguments: { type: "task", title: "Send proposal", related_type: "deal", related_id: DEAL_A },
    }));
    expect(created.created).toMatchObject({ organization_id: ORG_A, status: "pending", related_name: "Acme retainer", created_by: USER_A });

    const before = db.tables.deals[0].stage_changed_at;
    await client.callTool({ name: "update_deal", arguments: { id: DEAL_A, stage: "negotiation" } });
    expect(db.tables.deals[0].stage).toBe("negotiation");
    expect(db.tables.deals[0].stage_changed_at).not.toBe(before);
    expect(db.tables.deal_activities).toHaveLength(1);

    const note = parse(await client.callTool({ name: "add_note", arguments: { record_type: "deal", record_id: DEAL_A, content: "Called" } }));
    expect(note.created.author_name).toBe("John Harris");
  });

  it("refuses to link a record to another workspace", async () => {
    const client = await connect(writeKey.key);
    const res = await client.callTool({
      name: "create_contact",
      arguments: { name: "Bob", lead_id: LEAD_B },
    });
    expect(res.isError).toBe(true);
    expect(db.tables.contacts).toHaveLength(0);
  });
});

describe("api key helpers", () => {
  it("generates well-formed keys and hashes them deterministically", () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key).toMatch(/^pcrm_[A-Za-z0-9_-]{43}$/);
    expect(key.startsWith(prefix)).toBe(true);
    expect(hash).toBe(hashApiKey(key));
    expect(hash).toHaveLength(64);
  });
});
