import { decrypt, encrypt } from "@/lib/utils/encryption";
import { isGuestEmail } from "@/lib/auth/open-access";
import type { TwentyConnection, TwentyConnectionMetadata, TwentyDB, TwentyObject } from "./types";
export type { TwentyConnection, TwentyConnectionMetadata } from "./types";

/** v1 deliberately supports Twenty Cloud workspace hosts only. */
export function normalizeTwentyUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("Enter a valid Twenty workspace URL"); }
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash || !/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.twenty\.com$/i.test(url.hostname) || !/^\/*$/.test(url.pathname)) {
    throw new Error("Use an HTTPS Twenty Cloud workspace URL, such as https://orbix-sales.twenty.com");
  }
  if (["api", "app", "docs", "www"].includes(url.hostname.split(".")[0])) throw new Error("Enter the workspace hostname");
  return url.origin;
}

export function twentyKeyAad(orgId: string, connectionId: string, workspaceUrl: string): string {
  return `twenty_api_key:v1:${orgId}:${connectionId}:${normalizeTwentyUrl(workspaceUrl)}`;
}
export function sealTwentyApiKey(key: string, orgId: string, connectionId: string, url: string): string {
  if (!key.trim() || key.length > 8192) throw new Error("Enter a valid Twenty API key");
  return encrypt(key.trim(), twentyKeyAad(orgId, connectionId, url));
}

/** Uses a privileged server client; profile roles alone cannot distinguish anonymous admins. */
export async function assertTwentyOwner(db: TwentyDB, orgId: string, userId: string): Promise<void> {
  if (!orgId || !userId) throw new Error("Twenty access requires an authenticated owner or admin");
  const [{ data: profile, error }, auth] = await Promise.all([
    db.from("profiles").select("organization_id, role, email").eq("id", userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  const user = auth.data?.user;
  if (error || auth.error || !profile || !user || user.is_anonymous || isGuestEmail(user.email) || isGuestEmail(profile.email) || profile.organization_id !== orgId || !["admin", "owner"].includes(profile.role)) {
    throw new Error("Twenty access requires a non-guest owner or admin of this organization");
  }
}

export async function requireTwentyConnection(input: { db: TwentyDB; orgId: string; userId: string; connectionId?: string | null }): Promise<TwentyConnection> {
  // Callers must supply a privileged server client. RLS clients cannot access
  // credentials or distinguish an anonymous workspace admin through Auth Admin.
  const db = input.db;
  await assertTwentyOwner(db, input.orgId, input.userId);
  let query = db.from("twenty_connections").select("*").eq("organization_id", input.orgId).eq("status", "verified");
  if (input.connectionId) query = query.eq("id", input.connectionId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error("Connect and verify a Twenty workspace first");
  const connection = data as TwentyConnectionMetadata;
  const workspaceUrl = normalizeTwentyUrl(connection.workspace_url);
  const { data: secret, error: secretError } = await db.from("twenty_connection_credentials").select("api_key_ciphertext").eq("organization_id", input.orgId).eq("connection_id", connection.id).maybeSingle();
  if (secretError || !secret?.api_key_ciphertext) throw new Error("Twenty connection credential is unavailable");
  let apiKey: string;
  try { apiKey = decrypt(secret.api_key_ciphertext, twentyKeyAad(input.orgId, connection.id, workspaceUrl)); }
  catch { throw new Error("Twenty credential could not be decrypted; restore the original encryption key or reconnect"); }
  return { ...connection, workspace_url: workspaceUrl, apiKey };
}

export function assertTwentyWriteGate(connection: TwentyConnectionMetadata, object: TwentyObject): void {
  const audit = connection.cutover_audit;
  if (connection.status !== "verified" || !connection.cas_verified || !connection.writes_enabled || !audit?.verifiedNoUnexpectedEffects || !audit.coveredObjects.includes(object) || !audit.conditionalUpdateEvidence?.returnedOne || !audit.conditionalUpdateEvidence.staleRejected || !audit.coverageEvidence?.trim()) {
    throw new Error("Twenty writes are disabled until conditional updates and the native-trigger cutover are verified");
  }
}

/** Explicit whitelist: this function must never return credentials. */
export function publicTwentyConnection(connection: TwentyConnectionMetadata): TwentyConnectionMetadata {
  return {
    id: connection.id, organization_id: connection.organization_id, owner_id: connection.owner_id,
    workspace_url: connection.workspace_url, workspace_id: connection.workspace_id, revision: connection.revision,
    status: connection.status, cas_verified: connection.cas_verified, writes_enabled: connection.writes_enabled,
    cutover_audit: connection.cutover_audit, monthly_token_cap: connection.monthly_token_cap,
    verified_at: connection.verified_at,
  };
}
