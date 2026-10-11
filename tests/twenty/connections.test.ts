import { beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt } from "@/lib/utils/encryption";
import { assertTwentyOwner, assertTwentyWriteGate, normalizeTwentyUrl, publicTwentyConnection, requireTwentyConnection, sealTwentyApiKey, twentyKeyAad } from "@/lib/twenty/connections";
import type { TwentyConnectionMetadata, TwentyDB } from "@/lib/twenty/types";

const base: TwentyConnectionMetadata = { id: "c", organization_id: "org", owner_id: "user", workspace_url: "https://orbix-sales.twenty.com", workspace_id: "workspace", revision: 1, status: "verified", cas_verified: true, writes_enabled: false, cutover_audit: null, monthly_token_cap: null, verified_at: "2026-10-11T00:00:00Z" };
const audit = { reviewedAt: "2026-10-11T00:00:00Z", reviewedBy: "user", coveredObjects: ["person" as const], nativeTriggers: [], verifiedNoUnexpectedEffects: true, coverageEvidence: "All workflow/app hooks inspected; person hook paused.", conditionalUpdateEvidence: { recordId: "record", returnedOne: true, staleRejected: true, evidence: "One result on fresh version, zero results on stale version." } };
function dbMock(options: { role?: string; org?: string; anonymous?: boolean; guestEmail?: boolean; authError?: boolean; status?: string; missingSecret?: boolean } = {}) {
  const filters: [string, string, unknown][] = [];
  const from = vi.fn((table: string) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => { filters.push([table, key, value]); return query; }),
      maybeSingle: vi.fn(async () => ({ error: null, data: table === "profiles" ? { organization_id: options.org || "org", role: options.role || "admin", email: options.guestEmail ? "a@guest.local" : "owner@example.com" } : table === "twenty_connections" ? { ...base, status: options.status || "verified" } : options.missingSecret ? null : { api_key_ciphertext: sealTwentyApiKey("workspace-secret", "org", "c", base.workspace_url) } })),
    };
    return query;
  });
  return { db: { from, auth: { admin: { getUserById: vi.fn(async () => ({ error: options.authError ? { message: "revoked" } : null, data: { user: { id: "user", email: "owner@example.com", is_anonymous: options.anonymous || false } } })) } } } as unknown as TwentyDB, filters, from };
}
beforeEach(() => { vi.stubEnv("ENCRYPTION_KEY", "test-only-key"); });

describe("Twenty connection boundaries", () => {
  it("normalizes only HTTPS Twenty workspace origins", () => {
    expect(normalizeTwentyUrl(" https://orbix-sales.twenty.com/ ")).toBe(base.workspace_url);
    for (const url of ["http://orbix-sales.twenty.com", "https://orbix-sales.twenty.com.evil.test", "https://localhost", "https://127.0.0.1", "https://api.twenty.com", "https://orbix-sales.twenty.com:8443", "https://name:password@orbix-sales.twenty.com", "https://orbix-sales.twenty.com/mcp", "https://orbix-sales.twenty.com/?secret=1", "https://orbix-sales.twenty.com/#fragment"]) expect(() => normalizeTwentyUrl(url)).toThrow();
  });
  it("binds a sealed key to organization, connection and endpoint", () => {
    const sealed = sealTwentyApiKey("workspace-secret", "org", "c", base.workspace_url);
    expect(decrypt(sealed, twentyKeyAad("org", "c", base.workspace_url))).toBe("workspace-secret");
    expect(() => decrypt(sealed, twentyKeyAad("other", "c", base.workspace_url))).toThrow();
    expect(() => decrypt(sealed, twentyKeyAad("org", "other", base.workspace_url))).toThrow();
    expect(() => decrypt(sealed, twentyKeyAad("org", "c", "https://other.twenty.com"))).toThrow();
  });
  it("never serializes credentials or unexpected fields", () => {
    const publicRow = publicTwentyConnection({ ...base, apiKey: "secret", api_key_ciphertext: "encrypted" } as TwentyConnectionMetadata);
    expect(JSON.stringify(publicRow)).not.toContain("secret"); expect(publicRow).not.toHaveProperty("api_key_ciphertext");
  });
  it.each([{ role: "member" }, { anonymous: true }, { guestEmail: true }, { org: "other" }, { authError: true }])("denies non-pilot or revoked callers %j", async options => {
    await expect(assertTwentyOwner(dbMock(options).db, "org", "user")).rejects.toThrow("non-guest owner or admin");
  });
  it("loads a secret only after role authorization and organization-scoped queries", async () => {
    const { db, filters } = dbMock();
    const runtime = await requireTwentyConnection({ db, orgId: "org", userId: "user", connectionId: "c" });
    expect(runtime.apiKey).toBe("workspace-secret");
    expect(filters).toContainEqual(["twenty_connections", "organization_id", "org"]);
    expect(filters).toContainEqual(["twenty_connection_credentials", "organization_id", "org"]);
    expect(filters).toContainEqual(["twenty_connection_credentials", "connection_id", "c"]);
  });
  it("does not read secrets for denied users", async () => {
    const { db, from } = dbMock({ anonymous: true });
    await expect(requireTwentyConnection({ db, orgId: "org", userId: "user" })).rejects.toThrow();
    expect(from).not.toHaveBeenCalledWith("twenty_connection_credentials");
  });
  it("fails closed without credentials or full cutover evidence", async () => {
    await expect(requireTwentyConnection({ db: dbMock({ missingSecret: true }).db, orgId: "org", userId: "user" })).rejects.toThrow("unavailable");
    expect(() => assertTwentyWriteGate(base, "person")).toThrow("disabled");
    expect(() => assertTwentyWriteGate({ ...base, writes_enabled: true, cutover_audit: audit }, "person")).not.toThrow();
    expect(() => assertTwentyWriteGate({ ...base, writes_enabled: true, cutover_audit: audit }, "company")).toThrow();
    expect(() => assertTwentyWriteGate({ ...base, writes_enabled: true, cutover_audit: { ...audit, conditionalUpdateEvidence: { ...audit.conditionalUpdateEvidence, staleRejected: false } } }, "person")).toThrow();
  });
});
