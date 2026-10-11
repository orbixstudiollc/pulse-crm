"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireRole } from "./helpers";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeTwentyUrl, assertTwentyOwner, requireTwentyConnection, publicTwentyConnection, sealTwentyApiKey } from "@/lib/twenty/connections";
import { getTwentyClient } from "@/lib/twenty/client";
import { TWENTY_OBJECTS, assertTwentyObject } from "@/lib/twenty/metadata";
import { resolveTwentyRelay, validateTwentyRelayModels, TWENTY_RELAY_URL } from "@/lib/twenty/relay";
import { sealCustomApiKey } from "@/lib/ai/custom-provider";
import type { AIProviderSettings } from "@/lib/ai/provider-resolver";
import type { TwentyConnection, TwentyConnectionMetadata, TwentyCutoverAudit, TwentyDB, TwentyObject } from "@/lib/twenty/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function access() {
  const { user, orgId } = await requireRole("owner", "admin");
  const db: TwentyDB = createAdminClient();
  await assertTwentyOwner(db, orgId, user.id);
  return { db, orgId, userId: user.id };
}
function failure(error: unknown): { ok: false; error: string } {
  unstable_rethrow(error);
  // Database messages can carry query context: only expose application errors.
  return { ok: false, error: error instanceof Error ? error.message : "The Twenty configuration could not be updated" };
}

export async function getTwentyIntegrationState(): Promise<Result<{ connection: TwentyConnectionMetadata | null; relay: { configured: boolean; model: string; fastModel: string } }>> {
  try {
    const { db, orgId } = await access();
    const [{ data: connection, error }, { data: settings }] = await Promise.all([
      db.from("twenty_connections").select("*").eq("organization_id", orgId).maybeSingle(),
      db.from("ai_settings").select("organization_id,custom_base_url,custom_api_key,custom_model,custom_fast_model").eq("organization_id", orgId).maybeSingle(),
    ]);
    if (error) throw new Error("Twenty connection storage is unavailable; apply the reviewed migrations first");
    let relay = { configured: false, model: settings?.custom_model || "", fastModel: settings?.custom_fast_model || "" };
    try { const provider = resolveTwentyRelay(settings || {}, process.env); relay = { configured: true, model: provider.model, fastModel: provider.fastModel }; } catch { /* UI shows the missing configuration. */ }
    return { ok: true, data: { connection: connection ? publicTwentyConnection(connection as TwentyConnectionMetadata) : null, relay } };
  } catch (error) { return failure(error); }
}

export async function saveTwentyConnection(input: { workspaceUrl: string; apiKey?: string }): Promise<Result<TwentyConnectionMetadata>> {
  try {
    const { db, orgId, userId } = await access();
    const workspaceUrl = normalizeTwentyUrl(input.workspaceUrl);
    const { data: saved, error } = await db.from("twenty_connections").select("*").eq("organization_id", orgId).maybeSingle();
    if (error) throw new Error("Twenty connection storage is unavailable; apply the reviewed migrations first");
    if (saved && saved.workspace_url !== workspaceUrl) throw new Error("This pilot connection is bound to its original Twenty workspace. Reconnect only that workspace.");
    const id = saved?.id || randomUUID();
    let apiKey = input.apiKey?.trim();
    if (!apiKey && saved?.status === "verified" && saved.workspace_url === workspaceUrl) apiKey = (await requireTwentyConnection({ db, orgId, userId, connectionId: id })).apiKey;
    if (!apiKey) throw new Error("Enter the API key for this Twenty workspace");
    // Seal before making a request, so missing encryption cannot yield a usable but insecure save.
    let ciphertext: string;
    try { ciphertext = sealTwentyApiKey(apiKey, orgId, id, workspaceUrl); }
    catch { throw new Error("Secure storage requires the original ENCRYPTION_KEY; configure it before connecting"); }
    const candidate: TwentyConnection = { id, organization_id: orgId, owner_id: userId, workspace_url: workspaceUrl, workspace_id: saved?.workspace_url === workspaceUrl ? saved.workspace_id : "", revision: saved?.revision || 0, status: "verified", cas_verified: false, writes_enabled: false, cutover_audit: null, monthly_token_cap: null, verified_at: new Date().toISOString(), apiKey };
    const verified = await getTwentyClient(candidate).verify();
    if (saved && saved.workspace_id !== verified.workspaceId) throw new Error("The verified workspace identity changed; this connection cannot be reused for another workspace");
    const result = await db.rpc("save_twenty_connection", { p_id: id, p_org_id: orgId, p_owner_id: userId, p_url: workspaceUrl, p_workspace_id: verified.workspaceId, p_ciphertext: ciphertext, p_cas_verified: verified.casVerified, p_expected_revision: saved?.revision || 0 });
    if (result.error || !result.data) throw new Error("The connection changed or could not be saved; refresh and try again");
    revalidatePath("/dashboard/settings");
    return { ok: true, data: publicTwentyConnection(result.data as TwentyConnectionMetadata) };
  } catch (error) { return failure(error); }
}

export async function revokeTwentyConnection(connectionId: string, revision: number): Promise<Result<null>> {
  try {
    const { db, orgId, userId } = await access();
    const connection = await requireTwentyConnection({ db, orgId, userId, connectionId });
    if (connection.revision !== revision) throw new Error("Connection changed; refresh first");
    const { data, error } = await db.from("twenty_connections").update({ status: "revoked", revision: revision + 1, writes_enabled: false, cutover_audit: null, monthly_token_cap: null, updated_at: new Date().toISOString() }).eq("id", connectionId).eq("organization_id", orgId).eq("revision", revision).select("id");
    if (error || data?.length !== 1) throw new Error("Connection changed or could not be revoked");
    revalidatePath("/dashboard/settings"); return { ok: true, data: null };
  } catch (error) { return failure(error); }
}

export async function saveTwentyRelayConfiguration(input: { apiKey?: string; model: string; fastModel: string }): Promise<Result<{ models: string[] }>> {
  try {
    const { db, orgId } = await access();
    const { data: saved } = await db.from("ai_settings").select("*").eq("organization_id", orgId).maybeSingle();
    const model = input.model.trim(); const fastModel = input.fastModel.trim();
    if (!model || !fastModel || model.length > 200 || fastModel.length > 200) throw new Error("Enter a main and fast model from the LLMsRelay catalog");
    const key = input.apiKey?.trim();
    let encryptedKey = saved?.custom_api_key;
    if (key) {
      try { encryptedKey = sealCustomApiKey(key, orgId, TWENTY_RELAY_URL); }
      catch { throw new Error("Secure storage requires the original ENCRYPTION_KEY"); }
    } else if (saved?.custom_base_url !== TWENTY_RELAY_URL) throw new Error("Enter an LLMsRelay key before changing the provider endpoint");
    const settings: AIProviderSettings = { organization_id: orgId, custom_base_url: TWENTY_RELAY_URL, custom_api_key: encryptedKey, custom_model: model, custom_fast_model: fastModel };
    const provider = resolveTwentyRelay(settings, {});
    const models = await validateTwentyRelayModels(provider);
    const { error } = await db.from("ai_settings").upsert({ organization_id: orgId, custom_base_url: TWENTY_RELAY_URL, custom_api_key: encryptedKey, custom_model: model, custom_fast_model: fastModel }, { onConflict: "organization_id" });
    if (error) throw new Error("The verified LLMsRelay configuration could not be saved");
    revalidatePath("/dashboard/settings"); return { ok: true, data: { models } };
  } catch (error) { return failure(error); }
}

/** Explicit owner attestation follows the reviewed cutover; saving a key never enables writes. */
export async function recordTwentyCutover(input: { connectionId: string; revision: number; coveredObjects: string[]; nativeTriggers: TwentyCutoverAudit["nativeTriggers"]; verifiedNoUnexpectedEffects: boolean; coverageEvidence: string; conditionalUpdateEvidence: TwentyCutoverAudit["conditionalUpdateEvidence"] }): Promise<Result<TwentyConnectionMetadata>> {
  try {
    const { db, orgId, userId } = await access();
    const connection = await requireTwentyConnection({ db, orgId, userId, connectionId: input.connectionId });
    if (connection.revision !== input.revision) throw new Error("Connection changed; review the cutover again");
    if (!input.verifiedNoUnexpectedEffects || !Array.isArray(input.coveredObjects) || !input.coveredObjects.length || !Array.isArray(input.nativeTriggers) || input.nativeTriggers.length > 200) throw new Error("Complete the trigger audit and verify its effects first");
    const probe = input.conditionalUpdateEvidence;
    if (!probe?.returnedOne || !probe.staleRejected || !/^[0-9a-f-]{36}$/i.test(probe.recordId) || !probe.evidence?.trim() || probe.evidence.length > 2000 || !input.coverageEvidence?.trim() || input.coverageEvidence.length > 4000) throw new Error("Record the one-row update and stale-version rejection probe, and the complete native-trigger coverage evidence, before enabling writes");
    input.coveredObjects.forEach(assertTwentyObject);
    if (input.nativeTriggers.some(trigger => !trigger.id || !trigger.name || !["paused", "non_overlapping"].includes(trigger.resolution) || !trigger.evidence?.trim() || trigger.evidence.length > 2000)) throw new Error("Each native trigger needs an exact identity, resolution, and verification evidence");
    const verified = await getTwentyClient(connection).verify();
    const objects = [...new Set(input.coveredObjects)] as TwentyObject[];
    if (!verified.casVerified || objects.some(object => object !== "mailbox" && TWENTY_OBJECTS[object].writable.length && !verified.casObjects.includes(object))) throw new Error("Conditional updates are unsupported for one or more audited objects");
    const audit: TwentyCutoverAudit = { reviewedAt: new Date().toISOString(), reviewedBy: userId, coveredObjects: objects, nativeTriggers: input.nativeTriggers, verifiedNoUnexpectedEffects: true, coverageEvidence: input.coverageEvidence, conditionalUpdateEvidence: probe };
    const { data, error } = await db.from("twenty_connections").update({ cas_verified: true, writes_enabled: true, cutover_audit: audit, revision: connection.revision + 1, updated_at: new Date().toISOString() }).eq("id", connection.id).eq("organization_id", orgId).eq("revision", connection.revision).select("*").maybeSingle();
    if (error || !data) throw new Error("The connection changed; review the cutover again");
    revalidatePath("/dashboard/settings"); return { ok: true, data: publicTwentyConnection(data as TwentyConnectionMetadata) };
  } catch (error) { return failure(error); }
}
