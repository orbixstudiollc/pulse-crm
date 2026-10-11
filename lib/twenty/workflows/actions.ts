"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/helpers";
import { assertTwentyOwner, requireTwentyConnection } from "@/lib/twenty/connections";
import { getTwentyClient } from "@/lib/twenty/client";
import type { TwentyDB } from "@/lib/twenty/types";
import { listRegistryTools } from "@/lib/ai/tools/registry";
import { processTwentyJob } from "./worker";
import { normalizeQuickLeadInput, WORKFLOW_KINDS, type TwentyJob } from "./types";

async function session(connectionId?: string) {
  const { orgId, user } = await requireRole("owner", "admin");
  const db = createAdminClient() as unknown as TwentyDB;
  await assertTwentyOwner(db, orgId, user.id);
  const connection = await requireTwentyConnection({ db, orgId, userId: user.id, connectionId });
  return { db, orgId, userId: user.id, connection };
}

export async function getTwentyWorkflowsAction(connectionId?: string) {
  const { db, orgId, userId, connection } = await session(connectionId);
  const { error: ensureError } = await db.from("twenty_workflows").upsert(WORKFLOW_KINDS.map((kind) => ({ organization_id: orgId, connection_id: connection.id, connection_revision: connection.revision, owner_id: userId, kind })), { onConflict: "connection_id,kind", ignoreDuplicates: true });
  if (ensureError) throw new Error("Workflows could not be initialized");
  const [workflows, jobs, usage, accounts] = await Promise.all([
    db.from("twenty_workflows").select("id,kind,enabled,config,checkpoint,last_error,connection_revision").eq("organization_id", orgId).eq("connection_id", connection.id).eq("owner_id", userId),
    db.from("twenty_jobs").select("id,kind,status,attempts,created_at,result").eq("organization_id", orgId).eq("connection_id", connection.id).eq("owner_id", userId).order("created_at", { ascending: false }).limit(20),
    db.from("twenty_token_usage").select("used").eq("connection_id", connection.id).eq("month", new Date().toISOString().slice(0, 7) + "-01").maybeSingle(),
    getTwentyClient(connection).connectedAccounts().catch(() => []),
  ]);
  if (workflows.error || jobs.error || usage.error) throw new Error("Workflow status could not be loaded");
  return { connectionId: connection.id, connectionRevision: connection.revision, writesEnabled: connection.writes_enabled, tokenCap: connection.monthly_token_cap ?? null, tokensUsed: Number(usage.data?.used ?? 0), workflows: workflows.data ?? [], jobs: jobs.data ?? [], accounts };
}

const Settings = z.object({ connectionId: z.uuid(), kind: z.enum(WORKFLOW_KINDS), enabled: z.boolean(), monthlyTokenCap: z.number().int().min(0).max(100_000_000),
  connectedAccountId: z.uuid().optional(), fromHandle: z.email().optional(), recipients: z.array(z.email()).max(10).optional() }).strict();
export async function saveTwentyWorkflowAction(value: unknown) {
  const input = Settings.parse(value);
  const { db, orgId, userId, connection } = await session(input.connectionId);
  const { data: previous, error: previousError } = await db.from("twenty_workflows").select("owner_id,enabled,checkpoint,connection_revision").eq("organization_id", orgId).eq("connection_id", connection.id).eq("kind", input.kind).maybeSingle();
  if (previousError) throw new Error("Workflow settings could not be loaded");
  if (previous && previous.owner_id !== userId) throw new Error("This workflow is managed by another administrator");
  if (input.enabled && input.kind === "qualification" && input.monthlyTokenCap < 1) throw new Error("Configure a monthly token cap before enabling scheduled AI");
  if (input.enabled && input.kind === "mailbox_ready" && (!input.connectedAccountId || !input.fromHandle || !input.recipients?.length)) throw new Error("Select an email sender and notification recipients");
  if (input.kind === "mailbox_ready" && input.connectedAccountId) {
    const accounts = await getTwentyClient(connection).connectedAccounts();
    if (!accounts.some((account) => account.id === input.connectedAccountId && account.handle.toLowerCase() === input.fromHandle?.toLowerCase())) throw new Error("Select a connected Twenty sender");
  }
  const { error: capError } = await db.from("twenty_connections").update({ monthly_token_cap: input.monthlyTokenCap || null })
    .eq("organization_id", orgId).eq("id", connection.id).eq("revision", connection.revision);
  if (capError) throw new Error("Token cap could not be saved");
  const { error } = await db.from("twenty_workflows").upsert({ organization_id: orgId, connection_id: connection.id, connection_revision: connection.revision, owner_id: userId, kind: input.kind,
    enabled: input.enabled, config: input.kind === "mailbox_ready" ? { connectedAccountId: input.connectedAccountId, fromHandle: input.fromHandle, recipients: input.recipients } : {},
    // Keep the checkpoint on ordinary settings edits. Re-enabling starts from future changes.
    checkpoint: previous?.enabled && input.enabled && previous.connection_revision === connection.revision ? previous.checkpoint
      : input.enabled && input.kind !== "mailbox_ready" ? { initialized: true, updatedAfter: new Date().toISOString() }
      : input.enabled ? { baselineStartedAt: new Date().toISOString() } : {},
    lease_token: null, lease_until: null, updated_at: new Date().toISOString(),
  }, { onConflict: "connection_id,kind" });
  if (error) throw new Error("Workflow could not be saved");
}

export async function proposeQuickLeadAction(connectionId: string, value: unknown, requestId: string) {
  z.uuid().parse(requestId);
  const tool = listRegistryTools("workflow", "twenty").find((candidate) => candidate.name === "twenty_quick_lead");
  if (!tool) throw new Error("Quick Lead is unavailable");
  const payload = tool.inputSchema.parse(normalizeQuickLeadInput(value));
  const { db, orgId, userId, connection } = await session(z.uuid().parse(connectionId));
  const { data: inserted, error } = await db.from("twenty_jobs").upsert({ organization_id: orgId, connection_id: connection.id, connection_revision: connection.revision, owner_id: userId,
    kind: "quick_lead", payload, dedupe_key: `quick-lead:${userId}:${connection.id}:${connection.revision}:${requestId}` }, { onConflict: "organization_id,dedupe_key", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) throw new Error("Quick Lead could not be queued");
  if (inserted) {
    const token = randomUUID();
    const { data: claimed, error: claimError } = await db.from("twenty_jobs").update({ status: "running", attempts: 1, lease_token: token, lease_until: new Date(Date.now() + 90_000).toISOString() })
      .eq("organization_id", orgId).eq("id", inserted.id).eq("status", "queued").select("*").maybeSingle();
    if (claimError) throw new Error("Quick Lead could not be prepared");
    if (claimed) await processTwentyJob(db, claimed as TwentyJob);
  }
  const { data: outcome, error: outcomeError } = await db.from("twenty_jobs").select("status").eq("organization_id", orgId).eq("owner_id", userId)
    .eq("dedupe_key", `quick-lead:${userId}:${connection.id}:${connection.revision}:${requestId}`).maybeSingle();
  if (outcomeError || !outcome) throw new Error("Quick Lead status could not be loaded");
  return { queued: true, status: String(outcome.status) };
}
