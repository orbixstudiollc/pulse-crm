// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// In-memory service-role client. Every query chain is recorded (table, op,
// filters) and run against `db.tables`. Deleting a conversation applies the
// schema's foreign keys: copilot_messages and copilot_approvals rows cascade,
// copilot_artifacts.conversation_id is set to NULL.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Filter = [string, ...unknown[]];
type Chain = { table: string; op: "select" | "update" | "delete"; filters: Filter[]; payload?: Row };

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  chains: [] as Chain[],
  user: { id: "user-1", is_anonymous: false } as { id: string; is_anonymous: boolean },
  orgId: "org-1",
}));

/** Splits a PostgREST or() expression on top-level commas (not inside parentheses). */
function splitOr(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts;
}

function orPredicate(expr: string): (row: Row) => boolean {
  const tests = splitOr(expr).map((part) => {
    const [col, op, ...rest] = part.split(".");
    const raw = rest.join(".");
    if (op === "eq") return (r: Row) => String(r[col]) === raw;
    if (op === "is" && raw === "null") return (r: Row) => (r[col] ?? null) === null;
    if (op === "lt") {
      const value = raw.replace(/^"|"$/g, "");
      return (r: Row) => r[col] != null && String(r[col]) < value;
    }
    if (op === "in") {
      const values = raw.replace(/^\(|\)$/g, "").split(",");
      return (r: Row) => values.includes(String(r[col]));
    }
    throw new Error(`fake: or ${op} unsupported`);
  });
  return (row) => tests.some((t) => t(row));
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every(([name, ...args]) => {
    if (name === "eq") return row[args[0] as string] === args[1];
    if (name === "in") return (args[1] as unknown[]).includes(row[args[0] as string]);
    if (name === "or") return orPredicate(args[0] as string)(row);
    throw new Error(`fake: filter ${name} unsupported`);
  });
}

function project(row: Row, cols: string): Row {
  if (cols.trim() === "*") return { ...row };
  return Object.fromEntries(cols.split(",").map((c) => [c.trim(), row[c.trim()] ?? null]));
}

function cascadeConversationDelete(ids: unknown[]) {
  const t = db.tables;
  t.copilot_messages = (t.copilot_messages ?? []).filter((m) => !ids.includes(m.conversation_id));
  t.copilot_approvals = (t.copilot_approvals ?? []).filter((a) => !ids.includes(a.conversation_id));
  for (const artifact of t.copilot_artifacts ?? []) {
    if (ids.includes(artifact.conversation_id)) artifact.conversation_id = null;
  }
}

function fakeFrom(table: string) {
  const chain: Chain = { table, op: "select", filters: [] };
  db.chains.push(chain);
  let cols = "*";
  let mode: "many" | "maybe" = "many";

  const run = () => {
    const rows = db.tables[table] ?? (db.tables[table] = []);
    const hit = rows.filter((r) => matches(r, chain.filters));
    if (chain.op === "update") for (const r of hit) Object.assign(r, chain.payload);
    if (chain.op === "delete") {
      db.tables[table] = rows.filter((r) => !hit.includes(r));
      if (table === "copilot_conversations") cascadeConversationDelete(hit.map((r) => r.id));
    }
    const data = hit.map((r) => project(r, cols));
    if (mode === "maybe") return { data: data[0] ?? null, error: null };
    return { data, error: null };
  };

  const builder = {
    select(c = "*") {
      cols = c;
      return builder;
    },
    update(payload: Row) {
      chain.op = "update";
      chain.payload = payload;
      return builder;
    },
    delete() {
      chain.op = "delete";
      return builder;
    },
    eq(col: string, v: unknown) {
      chain.filters.push(["eq", col, v]);
      return builder;
    },
    in(col: string, vs: unknown[]) {
      chain.filters.push(["in", col, vs]);
      return builder;
    },
    or(expr: string) {
      chain.filters.push(["or", expr]);
      return builder;
    },
    maybeSingle() {
      mode = "maybe";
      return Promise.resolve(run());
    },
    then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
      return Promise.resolve().then(run).then(resolve, reject);
    },
  };
  return builder;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: fakeFrom }),
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: db.user } }) } }),
}));
vi.mock("@/lib/actions/helpers", () => ({
  getCurrentUserProfile: async () => ({ user: db.user, profile: { id: db.user.id, organization_id: db.orgId, role: "admin" } }),
  getOrgId: async () => db.orgId,
  requireRole: async () => ({ user: db.user, profile: { id: db.user.id, role: "admin" }, orgId: db.orgId }),
}));

const { getCopilotSettings, setAlwaysAllow, clearChatHistory } = await import("@/lib/actions/copilot-settings");
const { getBudgetUsage } = await import("@/lib/ai/shared-budget");
const { COPILOT_WRITE_TOOLS, NEVER_AUTO_ALLOW } = await import("@/lib/ai/tools/policy");

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "OLLAMA_BASE_URL",
  "CUSTOM_AI_API_KEY",
  "CUSTOM_AI_BASE_URL",
  "CUSTOM_AI_MODEL",
  "CUSTOM_AI_FAST_MODEL",
  "AI_SHARED_DAILY_TOKEN_LIMIT",
  "AI_SHARED_ORG_DAILY_TOKEN_LIMIT",
  "AI_SHARED_GUEST_DAILY_TOKEN_LIMIT",
];
const savedEnv: Record<string, string | undefined> = {};
const today = () => new Date().toISOString().slice(0, 10);
const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

function settingsRow(extra: Row = {}): Row {
  return {
    organization_id: "org-1",
    ai_provider: null,
    api_key: null,
    openrouter_api_key: null,
    openrouter_oauth_token: null,
    openrouter_expires_at: null,
    openai_api_key: null,
    groq_api_key: null,
    ollama_base_url: null,
    custom_base_url: null,
    custom_api_key: null,
    custom_model: null,
    custom_fast_model: null,
    copilot_always_allow: [],
    ...extra,
  };
}

const mutations = () => db.chains.filter((c) => c.op !== "select");

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  db.tables = {};
  db.chains = [];
  db.user = { id: "user-1", is_anonymous: false };
  db.orgId = "org-1";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// ─── setAlwaysAllow ─────────────────────────────────────────────────────────

describe("setAlwaysAllow", () => {
  beforeEach(() => {
    db.tables.ai_settings = [settingsRow(), settingsRow({ organization_id: "org-2", copilot_always_allow: ["add_note"] })];
  });

  it("persists only auto-allowable write tools: delete_record is dropped", async () => {
    const stored = await setAlwaysAllow(["delete_record", "update_lead"]);

    expect(stored).toEqual(["update_lead"]);
    expect(db.tables.ai_settings[0].copilot_always_allow).toEqual(["update_lead"]);
    const update = mutations();
    expect(update).toHaveLength(1);
    expect(update[0]).toMatchObject({ table: "ai_settings", op: "update" });
    expect(update[0].filters).toContainEqual(["eq", "organization_id", "org-1"]);
    // Another workspace's policy is untouched.
    expect(db.tables.ai_settings[1].copilot_always_allow).toEqual(["add_note"]);
  });

  it.each(["update_lead", { 0: "update_lead" }, null, 42] as unknown[])("persists [] for non-array input %j", async (input) => {
    db.tables.ai_settings[0].copilot_always_allow = ["add_note"];

    const stored = await setAlwaysAllow(input);

    expect(stored).toEqual([]);
    expect(db.tables.ai_settings[0].copilot_always_allow).toEqual([]);
  });

  it("drops unknown names, non-strings and duplicates", async () => {
    const stored = await setAlwaysAllow(["add_note", "add_note", 7, "drop_table", "search_leads", "update_deal"]);
    expect(stored).toEqual(["add_note", "update_deal"]);
    expect(db.tables.ai_settings[0].copilot_always_allow).toEqual(["add_note", "update_deal"]);
  });
});

// ─── clearChatHistory ───────────────────────────────────────────────────────

function seedHistory(lock: { c1?: string | null } = {}) {
  db.tables.copilot_conversations = [
    { id: "c1", organization_id: "org-1", user_id: "user-1", turn_lock_until: lock.c1 ?? null },
    { id: "c2", organization_id: "org-1", user_id: "user-1", turn_lock_until: null },
    { id: "c-other-user", organization_id: "org-1", user_id: "user-2", turn_lock_until: future() },
    { id: "c-other-org", organization_id: "org-2", user_id: "user-1", turn_lock_until: null },
  ];
  db.tables.copilot_messages = [
    { id: "m1", conversation_id: "c1" },
    { id: "m2", conversation_id: "c2" },
    { id: "m3", conversation_id: "c-other-user" },
  ];
  const approval = (id: string, conversation_id: string | null, source: string, status: string, organization_id = "org-1") => ({
    id,
    organization_id,
    conversation_id,
    source,
    status,
  });
  db.tables.copilot_approvals = [
    approval("a-pending", "c1", "chat", "pending"),
    approval("a-denied", "c2", "chat", "denied"),
    approval("a-expired", "c1", "chat", "expired"),
    approval("a-approved", "c1", "chat", "approved"),
    approval("a-applied", "c2", "chat", "applied"),
    approval("a-task-in-conv", "c1", "task", "pending"),
    approval("a-task", null, "task", "pending"),
    approval("a-other-user", "c-other-user", "chat", "pending"),
  ];
  db.tables.copilot_artifacts = [{ id: "art1", organization_id: "org-1", conversation_id: "c1" }];
  db.tables.copilot_memory = [{ id: "mem1", organization_id: "org-1", user_id: "user-1" }];
  db.tables.copilot_tasks = [{ id: "task1", organization_id: "org-1", user_id: "user-1" }];
}

const ids = (table: string) => (db.tables[table] ?? []).map((r) => r.id);

describe("clearChatHistory", () => {
  it("throws on the wrong confirmation and issues no query at all, so no delete", async () => {
    seedHistory();

    await expect(clearChatHistory("no")).rejects.toThrow(/CLEAR/);
    await expect(clearChatHistory("clear")).rejects.toThrow(/CLEAR/);

    expect(db.chains.filter((c) => c.op === "delete")).toHaveLength(0);
    expect(db.chains).toHaveLength(0);
    expect(ids("copilot_conversations")).toHaveLength(4);
  });

  it("deletes only the caller's conversations in the caller's org, with their messages", async () => {
    seedHistory();

    const result = await clearChatHistory("CLEAR");

    expect(result).toEqual({ deleted: 2 });
    expect(ids("copilot_conversations")).toEqual(["c-other-user", "c-other-org"]);
    expect(ids("copilot_messages")).toEqual(["m3"]);
    const del = db.chains.find((c) => c.op === "delete")!;
    expect(del.table).toBe("copilot_conversations");
    expect(del.filters).toContainEqual(["eq", "organization_id", "org-1"]);
    expect(del.filters).toContainEqual(["eq", "user_id", "user-1"]);
  });

  it("removes pending/denied/expired chat approvals but keeps approved, applied and task-sourced ones", async () => {
    seedHistory();

    await clearChatHistory("CLEAR");

    expect(ids("copilot_approvals").sort()).toEqual(
      ["a-applied", "a-approved", "a-other-user", "a-task", "a-task-in-conv"].sort()
    );
    const kept = Object.fromEntries(db.tables.copilot_approvals.map((a) => [a.id, a.conversation_id]));
    expect(kept["a-approved"]).toBeNull();
    expect(kept["a-task-in-conv"]).toBeNull();
    expect(kept["a-other-user"]).toBe("c-other-user");
    // The detach is scoped to this org.
    const detach = db.chains.find((c) => c.table === "copilot_approvals" && c.op === "update")!;
    expect(detach.filters).toContainEqual(["eq", "organization_id", "org-1"]);
  });

  it("leaves artifacts, memory and tasks untouched (artifacts only lose the conversation link)", async () => {
    seedHistory();

    await clearChatHistory("CLEAR");

    expect(db.tables.copilot_artifacts).toEqual([{ id: "art1", organization_id: "org-1", conversation_id: null }]);
    expect(ids("copilot_memory")).toEqual(["mem1"]);
    expect(ids("copilot_tasks")).toEqual(["task1"]);
    const touched = new Set(mutations().map((c) => c.table));
    expect([...touched].sort()).toEqual(["copilot_approvals", "copilot_conversations"]);
  });

  it("refuses with turn_in_progress while one of the caller's conversations holds an unexpired turn lock", async () => {
    seedHistory({ c1: future() });

    const result = await clearChatHistory("CLEAR");

    expect(result).toEqual({ error: "turn_in_progress" });
    expect(mutations()).toHaveLength(0);
    expect(ids("copilot_conversations")).toHaveLength(4);
    expect(ids("copilot_approvals")).toHaveLength(8);
  });

  it("an expired turn lock does not block clearing", async () => {
    seedHistory({ c1: past() });

    await expect(clearChatHistory("CLEAR")).resolves.toEqual({ deleted: 2 });
  });

  it("returns deleted: 0 when the caller has no conversations", async () => {
    db.tables.copilot_conversations = [{ id: "x", organization_id: "org-1", user_id: "user-2", turn_lock_until: null }];

    await expect(clearChatHistory("CLEAR")).resolves.toEqual({ deleted: 0 });
    expect(mutations()).toHaveLength(0);
  });
});

// ─── getCopilotSettings / getBudgetUsage ────────────────────────────────────

describe("getCopilotSettings", () => {
  it("never returns key material", async () => {
    process.env.OPENAI_API_KEY = "sk-env-openai-secret";
    process.env.ANTHROPIC_API_KEY = "sk-ant-env-secret";
    db.tables.ai_settings = [
      settingsRow({
        api_key: "sk-ant-org-SECRET-123",
        openai_api_key: "sk-proj-org-secret",
        openrouter_api_key: "sk-or-v1-secret",
        openrouter_oauth_token: "sk-or-oauth-secret",
        openrouter_expires_at: future(),
        groq_api_key: "gsk_secret",
        custom_api_key: "sealed-secret",
      }),
    ];

    const settings = await getCopilotSettings();

    expect(JSON.stringify(settings)).not.toMatch(/sk-|api_key|secret/i);
    expect(settings.provider).toEqual({
      source: "org",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      supportsTools: true,
    });
  });

  it("returns the sanitized always-allow list and the allowable tools without NEVER_AUTO_ALLOW names", async () => {
    db.tables.ai_settings = [settingsRow({ api_key: "k", copilot_always_allow: ["update_lead", "delete_record", 3] })];

    const settings = await getCopilotSettings();

    expect(settings.alwaysAllow).toEqual(["update_lead"]);
    const names = settings.allowableTools.map((t) => t.name);
    expect(names).toEqual(COPILOT_WRITE_TOOLS.filter((n) => !NEVER_AUTO_ALLOW.includes(n)));
    expect(names).not.toContain("delete_record");
    expect(settings.allowableTools).toContainEqual({ name: "convert_lead_to_customer", label: "Convert lead to customer" });
  });

  it("on the shared env key reports today's org and site usage against the shared limits", async () => {
    process.env.OPENAI_API_KEY = "sk-env";
    process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT = "1000";
    process.env.AI_SHARED_DAILY_TOKEN_LIMIT = "9000";
    db.tables.ai_settings = [settingsRow()];
    db.tables.ai_shared_budget = [
      { scope: "org-1", day: today(), used: 250 },
      { scope: "site", day: today(), used: 4000 },
      { scope: "guest", day: today(), used: 77 },
      { scope: "org-1", day: "2000-01-01", used: 999 },
      { scope: "org-2", day: today(), used: 500 },
    ];

    const settings = await getCopilotSettings();

    expect(settings.provider).toEqual({ source: "env", provider: "openai", model: "claude-sonnet-4-6", supportsTools: false });
    expect(settings.usage).toEqual({
      orgUsedTokens: 250,
      orgLimitTokens: 1000,
      sharedUsedTokens: 4000,
      sharedLimitTokens: 9000,
      isGuest: false,
    });
  });

  it("a guest sees the guest pool; a workspace on its own key has no org limit", async () => {
    db.user = { id: "guest-1", is_anonymous: true };
    process.env.AI_SHARED_GUEST_DAILY_TOKEN_LIMIT = "300";
    db.tables.ai_settings = [settingsRow({ api_key: "k" })];
    db.tables.ai_shared_budget = [
      { scope: "site", day: today(), used: 4000 },
      { scope: "guest", day: today(), used: 77 },
    ];

    const settings = await getCopilotSettings();

    expect(settings.usage).toEqual({
      orgUsedTokens: 0,
      orgLimitTokens: null,
      sharedUsedTokens: 77,
      sharedLimitTokens: 300,
      isGuest: true,
    });
  });

  it("reports no provider when nothing is configured", async () => {
    const settings = await getCopilotSettings();
    expect(settings.provider).toEqual({ source: "none", provider: null, model: null, supportsTools: false });
    expect(settings.alwaysAllow).toEqual([]);
  });
});

describe("getBudgetUsage", () => {
  it("is a read-only query scoped to today and the org's scope", async () => {
    db.tables.ai_shared_budget = [{ scope: "org-1", day: today(), used: 12 }];

    const usage = await getBudgetUsage("org-1");

    expect(usage).toMatchObject({ orgUsedTokens: 12, sharedUsedTokens: 0 });
    expect(db.chains).toHaveLength(1);
    expect(db.chains[0]).toMatchObject({ table: "ai_shared_budget", op: "select" });
    expect(db.chains[0].filters).toContainEqual(["eq", "day", today()]);
    expect(db.chains[0].filters).toContainEqual(["in", "scope", ["org-1", "site"]]);
  });
});
