import { assertSafeFetchTarget } from "@/lib/security/fetch-target";
import { createPinnedFetch } from "@/lib/security/safe-fetch";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { assertTwentyWriteGate, normalizeTwentyUrl } from "./connections";
import { TWENTY_OBJECTS, assertTwentyObject, validateTwentyPatch } from "./metadata";
import type { TwentyConnection, TwentyEmailInput, TwentyListResult, TwentyObject, TwentyRecord } from "./types";
export type { TwentyObject, TwentyRecord } from "./types";

export class TwentyApiError extends Error {
  constructor(message: string, public code: string, public outcome?: "unknown_outcome") { super(message); this.name = "TwentyApiError"; }
}
type TypeRef = { kind: string; name: string | null; ofType?: TypeRef | null };
type SchemaField = { name: string; type: TypeRef; args?: SchemaField[] };
export type SchemaType = { name: string; kind: string; fields?: SchemaField[] | null; inputFields?: SchemaField[] | null; enumValues?: { name: string }[] | null };
export type TwentySchema = { queryType: { name: string }; mutationType?: { name: string }; types: SchemaType[] };
const typeFragment = "kind name ofType { kind name ofType { kind name ofType { kind name } } }";
const introspection = `query PulseTwentySchema { __schema { queryType { name } mutationType { name } types { kind name fields { name type { ${typeFragment} } args { name type { ${typeFragment} } } } inputFields { name type { ${typeFragment} } } enumValues { name } } } }`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function named(type: TypeRef): string { if (type.name) return type.name; if (type.ofType) return named(type.ofType); throw new TwentyApiError("Unsupported Twenty schema type", "schema_unsupported"); }
function typeString(type: TypeRef): string { if (type.kind === "NON_NULL") return `${typeString(type.ofType!)}!`; if (type.kind === "LIST") return `[${typeString(type.ofType!)}]`; return named(type); }
function capitalize(value: string): string { return value[0].toUpperCase() + value.slice(1); }

export function supportsTwentyCas(schema: TwentySchema, object: TwentyObject): boolean {
  const policy = TWENTY_OBJECTS[object];
  const mutations = schema.types.find(t => t.name === schema.mutationType?.name)?.fields || [];
  const field = mutations.find(f => [`update${capitalize(policy.plural)}`, `updateMany${capitalize(policy.plural)}`].includes(f.name));
  const filter = field?.args?.find(arg => arg.name === "filter");
  const inputs = schema.types.find(t => t.name === (filter ? named(filter.type) : ""))?.inputFields || [];
  return ["id", "updatedAt"].every(key => {
    const input = inputs.find(f => f.name === key);
    return input && schema.types.find(t => t.name === named(input.type))?.inputFields?.some(f => f.name === "eq");
  }) && Boolean(field?.args?.find(arg => arg.name === "data"));
}

/** All documents are assembled from static policies intersected with authenticated schema. */
export class TwentyClient {
  private schemaPromise?: Promise<TwentySchema>;
  readonly workspaceUrl: string;
  constructor(private connection: TwentyConnection, private injectedFetch?: typeof fetch) {
    this.workspaceUrl = normalizeTwentyUrl(connection.workspace_url);
  }

  private async request(path: "/graphql" | "/metadata", query: string, variables: Record<string, unknown> = {}, mutation = false): Promise<Record<string, unknown>> {
    const pinned = this.injectedFetch ? { fetch: this.injectedFetch, close: async () => {} } : createPinnedFetch(await assertSafeFetchTarget(this.workspaceUrl));
    try {
      const response = await pinned.fetch(`${this.workspaceUrl}${path}`, {
        method: "POST", headers: { authorization: `Bearer ${this.connection.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ query, variables }), redirect: "manual", signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new TwentyApiError(`Twenty request failed (HTTP ${response.status})`, "request_rejected", mutation && (response.status >= 500 || response.status === 408) ? "unknown_outcome" : undefined);
      const text = await cappedBody(response, 8_388_608);
      const body = JSON.parse(text) as { data?: Record<string, unknown>; errors?: { extensions?: { code?: string } }[] };
      if (body.errors?.length) {
        const rejected = body.errors.every(error => ["GRAPHQL_VALIDATION_FAILED", "BAD_USER_INPUT", "UNAUTHENTICATED", "FORBIDDEN"].includes(error.extensions?.code || ""));
        throw new TwentyApiError("Twenty rejected the operation; verify permissions and the deployed schema", "request_rejected", mutation && !rejected ? "unknown_outcome" : undefined);
      }
      if (!body.data) throw new Error("Missing response data");
      return body.data;
    } catch (error) {
      if (error instanceof TwentyApiError) throw error;
      throw new TwentyApiError("Twenty request could not be completed", "request_failed", mutation ? "unknown_outcome" : undefined);
    } finally { await pinned.close(); }
  }

  private async schema(): Promise<TwentySchema> {
    this.schemaPromise ??= this.request("/graphql", introspection).then(data => {
      const schema = data.__schema as TwentySchema;
      if (!schema?.queryType?.name || !Array.isArray(schema.types)) throw new TwentyApiError("Twenty schema verification failed", "schema_unsupported");
      return schema;
    });
    return this.schemaPromise;
  }
  private root(schema: TwentySchema, mutation: boolean, candidates: string[]): SchemaField {
    const field = schema.types.find(t => t.name === (mutation ? schema.mutationType?.name : schema.queryType.name))?.fields?.find(f => candidates.includes(f.name));
    if (!field) throw new TwentyApiError("This operation is unavailable in the deployed Twenty schema", "schema_unsupported");
    return field;
  }
  private selection(schema: TwentySchema, object: TwentyObject): string {
    const fields = schema.types.find(t => t.name === capitalize(object))?.fields || [];
    const selections = TWENTY_OBJECTS[object].fields.flatMap(key => {
      const field = fields.find(f => f.name === key); if (!field) return [];
      const type = schema.types.find(t => t.name === named(field.type));
      if (type?.kind !== "OBJECT") return [key];
      // Composite values contain only explicitly listed scalar subfields. Never follow relations.
      const composites: Record<string, string[]> = {
        name: ["firstName", "lastName"], emails: ["primaryEmail", "additionalEmails"], phones: ["primaryPhoneNumber", "primaryPhoneCountryCode", "primaryPhoneCallingCode"],
        domainName: ["primaryLinkUrl", "primaryLinkLabel"], linkedinLink: ["primaryLinkUrl", "primaryLinkLabel"], amount: ["amountMicros", "currencyCode"], bodyV2: ["markdown", "blocknote"], createdBy: ["source"], updatedBy: ["source"],
      };
      const children = (composites[key] || []).filter(child => type.fields?.some(f => f.name === child && !["OBJECT", "INTERFACE", "UNION"].includes(schema.types.find(t => t.name === named(f.type))?.kind || "")));
      return children.length ? [`${key} { ${children.join(" ")} }`] : [];
    });
    if (!selections.includes("id") || !selections.includes("updatedAt")) throw new TwentyApiError("Twenty record identity/version fields are unavailable", "schema_unsupported");
    return selections.join(" ");
  }
  private arguments(field: SchemaField, values: Record<string, unknown>): { declarations: string; call: string; variables: Record<string, unknown> } {
    const supplied = Object.keys(values).filter(key => values[key] !== undefined);
    const declarations: string[] = []; const call: string[] = []; const variables: Record<string, unknown> = {};
    for (const key of supplied) {
      const arg = field.args?.find(a => a.name === key);
      if (!arg) throw new TwentyApiError("Twenty operation arguments are unsupported", "schema_unsupported");
      declarations.push(`$${key}: ${typeString(arg.type)}`); call.push(`${key}: $${key}`); variables[key] = values[key];
    }
    return { declarations: declarations.length ? `(${declarations.join(", ")})` : "", call: call.length ? `(${call.join(", ")})` : "", variables };
  }

  async verify(): Promise<{ workspaceId: string; casVerified: boolean; casObjects: TwentyObject[]; objects: TwentyObject[] }> {
    const identity = await this.request("/metadata", "query PulseTwentyIdentity { currentWorkspace { id subdomain } }");
    const workspace = identity.currentWorkspace as { id?: string; subdomain?: string };
    if (!workspace?.id || workspace.subdomain?.toLowerCase() !== new URL(this.workspaceUrl).hostname.split(".")[0]) throw new TwentyApiError("The key belongs to a different Twenty workspace", "workspace_mismatch");
    if (this.connection.workspace_id && this.connection.workspace_id !== workspace.id) throw new TwentyApiError("Twenty workspace identity changed; reconnect", "workspace_mismatch");
    const schema = await this.schema();
    const objects = (Object.keys(TWENTY_OBJECTS) as TwentyObject[]).filter(object => schema.types.some(t => t.name === capitalize(object)));
    const casObjects = objects.filter(object => supportsTwentyCas(schema, object));
    // Minimal CRM reads verify actual data permission, not just introspection access.
    await this.list("person", { limit: 1 }); await this.list("company", { limit: 1 });
    return { workspaceId: workspace.id, casVerified: ["person", "company"].every(object => casObjects.includes(object as TwentyObject)), casObjects, objects };
  }

  async list(object: TwentyObject, options: { search?: string; updatedAfter?: string; after?: string | null; limit?: number; filter?: Record<string, unknown> } = {}): Promise<TwentyListResult> {
    assertTwentyObject(object); const schema = await this.schema();
    const field = this.root(schema, false, [TWENTY_OBJECTS[object].plural]);
    if (options.updatedAfter && !field.args?.some(arg => arg.name === "orderBy")) throw new TwentyApiError("Incremental polling requires stable deployed ordering", "schema_unsupported");
    const filter: Record<string, unknown> = { ...(options.filter || {}) };
    validateFilter(object, filter);
    if (options.updatedAfter) {
      if (!Number.isFinite(Date.parse(options.updatedAfter))) throw new Error("Invalid polling timestamp");
      filter.updatedAt = { gte: options.updatedAfter };
    }
    if (options.search) {
      if (options.search.length > 200) throw new Error("Search is too long");
      const fields = TWENTY_OBJECTS[object].search;
      const typeFields = schema.types.find(t => t.name === capitalize(object))?.fields || [];
      const or = fields.filter(key => typeFields.some(f => f.name === key)).flatMap<Record<string, unknown>>(key => {
        const ilike = { ilike: `%${options.search!.replace(/[%_\\]/g, "\\$&")}%` };
        if (key === "name" && object === "person") return [{ name: { firstName: ilike } }, { name: { lastName: ilike } }];
        if (key === "emails") return [{ emails: { primaryEmail: ilike } }];
        return [{ [key]: ilike }];
      });
      if (!or.length) throw new Error("Search is unavailable for this Twenty object");
      filter.or = or;
    }
    const values: Record<string, unknown> = { first: Math.max(1, Math.min(options.limit || 25, 100)) };
    if (Object.keys(filter).length) values.filter = filter;
    if (options.after) values.after = options.after;
    if (field.args?.some(a => a.name === "orderBy")) values.orderBy = [{ updatedAt: "AscNullsFirst" }, { id: "AscNullsFirst" }];
    const args = this.arguments(field, values);
    const result = await this.request("/graphql", `query PulseTwentyRead${args.declarations} { ${field.name}${args.call} { edges { node { ${this.selection(schema, object)} } } pageInfo { endCursor hasNextPage } } }`, args.variables);
    const connection = result[field.name] as { edges?: { node: TwentyRecord }[]; pageInfo?: { endCursor?: string | null; hasNextPage?: boolean } };
    if (!Array.isArray(connection?.edges)) throw new TwentyApiError("Twenty returned invalid records", "invalid_response");
    return { records: connection.edges.map(edge => edge.node), endCursor: connection.pageInfo?.endCursor || null, hasNextPage: connection.pageInfo?.hasNextPage === true };
  }
  async get(object: TwentyObject, id: string): Promise<TwentyRecord | null> {
    if (!uuid.test(id)) throw new Error("Invalid Twenty record ID");
    const result = await this.list(object, { filter: { id: { eq: id } }, limit: 1 }); return result.records[0] || null;
  }
  async update(object: TwentyObject, id: string, expectedUpdatedAt: string, data: Record<string, unknown>): Promise<TwentyRecord> {
    assertTwentyWriteGate(this.connection, object); validateTwentyPatch(object, data);
    if (!uuid.test(id) || !Number.isFinite(Date.parse(expectedUpdatedAt))) throw new Error("Record identity and approved version are required");
    const schema = await this.schema();
    if (!supportsTwentyCas(schema, object)) throw new TwentyApiError("Conditional updates are unsupported; writes remain disabled", "schema_unsupported");
    const field = this.root(schema, true, [`update${capitalize(TWENTY_OBJECTS[object].plural)}`, `updateMany${capitalize(TWENTY_OBJECTS[object].plural)}`]);
    const args = this.arguments(field, { filter: { id: { eq: id }, updatedAt: { eq: expectedUpdatedAt } }, data });
    const result = await this.request("/graphql", `mutation PulseTwentyApprovedUpdate${args.declarations} { ${field.name}${args.call} { ${this.selection(schema, object)} } }`, args.variables, true);
    const records = result[field.name];
    if (Array.isArray(records) && records.length === 0) throw new TwentyApiError("The record changed after approval; review a refreshed proposal", "record_changed");
    if (!Array.isArray(records) || records.length !== 1 || records[0]?.id !== id) throw new TwentyApiError("The conditional update result requires reconciliation", "invalid_response", "unknown_outcome");
    return records[0] as TwentyRecord;
  }
  async create(object: TwentyObject, data: Record<string, unknown>): Promise<TwentyRecord> {
    assertTwentyWriteGate(this.connection, object); validateTwentyPatch(object, data);
    const schema = await this.schema();
    const field = this.root(schema, true, [`create${capitalize(object)}`, `createOne${capitalize(object)}`]);
    const args = this.arguments(field, { data });
    const result = await this.request("/graphql", `mutation PulseTwentyApprovedCreate${args.declarations} { ${field.name}${args.call} { ${this.selection(schema, object)} } }`, args.variables, true);
    const record = result[field.name] as TwentyRecord;
    if (!record?.id) throw new TwentyApiError("The creation result requires reconciliation", "invalid_response", "unknown_outcome");
    return record;
  }
  private async coreTool(name: "find_connected_accounts" | "send_email", input: Record<string, unknown>, mutation = false): Promise<unknown> {
    const pinned = this.injectedFetch ? { fetch: this.injectedFetch, close: async () => {} } : createPinnedFetch(await assertSafeFetchTarget(this.workspaceUrl));
    const client = new Client({ name: "pulse-twenty-approved-actions", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${this.workspaceUrl}/mcp`), { requestInit: { headers: { authorization: `Bearer ${this.connection.apiKey}` } }, fetch: pinned.fetch, reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 } });
    let executing = false;
    try {
      await client.connect(transport, { timeout: 15_000 });
      const catalog = await client.callTool({ name: "get_tool_catalog", arguments: { categories: ["ACTION"] } }, undefined, { timeout: 15_000 });
      if (catalog.isError || !JSON.stringify(catalog).includes(name)) throw new TwentyApiError("Twenty core mailbox action is unavailable", "schema_unsupported");
      const learned = await client.callTool({ name: "learn_tools", arguments: { toolNames: [name], aspects: ["schema"] } }, undefined, { timeout: 15_000 });
      const schemaText = JSON.stringify(learned);
      if (learned.isError || schemaText.includes('"notFound":["' + name + '"')) throw new TwentyApiError("Twenty core mailbox action is unavailable", "schema_unsupported");
      executing = true;
      const result = await client.callTool({ name: "execute_tool", arguments: { toolName: name, arguments: input } }, undefined, { timeout: 20_000 });
      if (result.isError) throw new TwentyApiError("Twenty mailbox action requires reconciliation", "request_rejected", mutation ? "unknown_outcome" : undefined);
      const parsed = parseMcpResult(result);
      if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).success === false) throw new TwentyApiError("Twenty mailbox action was not confirmed", "request_rejected", mutation ? "unknown_outcome" : undefined);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || (parsed as Record<string, unknown>).success !== true) throw new TwentyApiError("Twenty mailbox action returned an unsupported response", "invalid_response", mutation ? "unknown_outcome" : undefined);
      return parsed;
    } catch (error) {
      if (error instanceof TwentyApiError) throw error;
      throw new TwentyApiError("Twenty mailbox action could not be completed", "request_failed", mutation && executing ? "unknown_outcome" : undefined);
    } finally { await client.close().catch(() => undefined); await pinned.close(); }
  }
  async connectedAccounts(): Promise<{ id: string; handle: string; name?: string }[]> {
    const result = await this.coreTool("find_connected_accounts", {});
    const raw = unwrapCoreResult(result);
    const accounts = Array.isArray(raw) ? raw : raw.connectedAccounts || raw.accounts || raw.records || raw.data;
    if (!Array.isArray(accounts)) throw new TwentyApiError("Connected account discovery returned an unsupported response", "invalid_response");
    return accounts.flatMap(account => typeof account?.id === "string" && typeof account?.handle === "string" ? [{ id: account.id, handle: account.handle, ...(typeof account.name === "string" ? { name: account.name } : {}) }] : []);
  }
  async sendEmail(input: TwentyEmailInput): Promise<unknown> {
    assertTwentyWriteGate(this.connection, "mailbox");
    if (!uuid.test(input.connectedAccountId) || !input.fromHandle || !input.subject.trim() || input.subject.length > 998 || !input.body || input.body.length > 65_536 || !input.recipients.length || input.recipients.length > 20 || input.recipients.some(email => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) || /[\r\n]/.test(input.fromHandle + input.subject)) throw new Error("Invalid email sender, recipients, subject, or body");
    const account = (await this.connectedAccounts()).find(account => account.id === input.connectedAccountId && account.handle === input.fromHandle);
    if (!account) throw new Error("The approved connected sender is no longer available");
    const result = unwrapCoreResult(await this.coreTool("send_email", { ...input, recipients: { to: input.recipients.join(","), cc: "", bcc: "" } }, true));
    if (typeof result.headerMessageId !== "string" || !result.headerMessageId.trim()) throw new TwentyApiError("The email delivery result requires reconciliation", "invalid_response", "unknown_outcome");
    return { sent: true, headerMessageId: result.headerMessageId, ...(typeof result.messageId === "string" ? { messageId: result.messageId } : {}) };
  }
  readMany = this.list.bind(this);
  readOne = this.get.bind(this);
  updateIfUnchanged = this.update.bind(this);
  createOne = this.create.bind(this);
  findConnectedAccounts = this.connectedAccounts.bind(this);
}

function validateFilter(object: TwentyObject, filter: Record<string, unknown>): void {
  const allowed = TWENTY_OBJECTS[object].fields;
  for (const key of Object.keys(filter)) if (!allowed.includes(key)) throw new Error("Twenty filter field is not allowed");
  const validate = (value: unknown, depth: number) => {
    if (depth > 4) throw new Error("Twenty filter is too deeply nested");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Twenty filter is invalid");
    for (const [key, child] of Object.entries(value)) {
      if (["eq", "gte", "gt", "lte", "lt", "ilike"].includes(key)) {
        if (!["string", "number", "boolean"].includes(typeof child) && child !== null) throw new Error("Twenty filter values must be scalar");
      } else if (["firstName", "lastName", "primaryEmail", "primaryLinkUrl"].includes(key)) validate(child, depth + 1);
      else throw new Error("Twenty filter operation is not allowed");
    }
  };
  Object.values(filter).forEach(value => validate(value, 0));
}
async function cappedBody(response: Response, max: number): Promise<string> {
  if (!response.body) throw new Error("Empty Twenty response");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); throw new Error("Twenty response is too large"); } chunks.push(value); }
  return Buffer.concat(chunks).toString("utf8");
}
function parseMcpResult(result: Record<string, unknown>): unknown {
  if (result.structuredContent) return result.structuredContent;
  const content = result.content as { type?: string; text?: string }[];
  const text = content?.filter(block => block.type === "text").map(block => block.text).join("\n");
  try { return JSON.parse(text); } catch { throw new TwentyApiError("Twenty mailbox action returned an unsupported response", "invalid_response", "unknown_outcome"); }
}
function unwrapCoreResult(result: unknown): Record<string, unknown> {
  if (Array.isArray(result)) return { records: result };
  if (!result || typeof result !== "object") return {};
  const raw = result as Record<string, unknown>;
  return raw.result && typeof raw.result === "object" ? raw.result as Record<string, unknown> : raw;
}
export function getTwentyClient(connection: TwentyConnection): TwentyClient { return new TwentyClient(connection); }
