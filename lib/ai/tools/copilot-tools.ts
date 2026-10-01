// Copilot-only tools: save_artifact, save_memory, draft_email, create_task, suggest_next.
// registry.ts decides each tool's kind from policy.ts (LOW_RISK_WRITES, UI_TOOLS); the `kind`
// here is the declared default. Nothing here sends email: draft_email only stores an artifact.
import { z } from "zod";
import { computeNextRun, TASK_CAPS } from "@/lib/ai/tasks/schedule";
import type { CopilotArtifactKind, Json } from "@/types/database";
import type { CopilotToolEnv, RegistryTool } from "./registry";

type Failure = { ok: false; error: string };

const LINKED_RECORD_TYPES = ["lead", "deal", "customer", "contact", "competitor"] as const;
const ARTIFACT_KINDS = ["email_draft", "lead_list", "report", "note"] as const;
const MEMORY_TITLE_MAX = 60;

const linkedFields = {
  linkedRecordType: z.enum(LINKED_RECORD_TYPES).optional(),
  linkedRecordId: z.string().uuid().optional(),
};

const saveArtifactSchema = z.object({
  kind: z.enum(ARTIFACT_KINDS),
  title: z.string().min(1).max(200),
  content: z.record(z.string(), z.unknown()),
  ...linkedFields,
});

const saveMemorySchema = z.object({ content: z.string().min(1).max(2000) });

const draftEmailSchema = z.object({
  to: z.string().max(320).optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  ...linkedFields,
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(120),
  prompt: z.string().min(1).max(4000),
  schedule: z.enum(["daily", "weekly", "monthly"]),
});

const suggestNextSchema = z.object({
  question: z.string().max(120).optional(),
  options: z
    .array(z.object({ label: z.string().min(1).max(40), prompt: z.string().min(1).max(300) }))
    .min(1)
    .max(4),
});

type SaveArtifactInput = z.infer<typeof saveArtifactSchema>;

async function saveArtifact(input: SaveArtifactInput, env: CopilotToolEnv): Promise<{ artifactId: string; undo: { tool: "save_artifact"; id: string } } | Failure> {
  const { data, error } = await env.db
    .from("copilot_artifacts")
    .insert({
      organization_id: env.ctx.orgId,
      user_id: env.ctx.userId,
      conversation_id: env.ctx.conversationId,
      task_id: env.ctx.taskId,
      kind: input.kind as CopilotArtifactKind,
      title: input.title,
      content: input.content as Json,
      linked_record_type: input.linkedRecordType ?? null,
      linked_record_id: input.linkedRecordId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "save_failed" };
  const id = String((data as { id: unknown }).id);
  return { artifactId: id, undo: { tool: "save_artifact", id } };
}

async function saveMemory(input: z.infer<typeof saveMemorySchema>, env: CopilotToolEnv) {
  if (!env.ctx.userId) return { ok: false, error: "no_user" } as Failure;
  const content = input.content.trim();
  // The type is fixed: model-written memory is never 'guidance', whatever the input carries.
  const { data, error } = await env.db
    .from("copilot_memory")
    .insert({
      organization_id: env.ctx.orgId,
      user_id: env.ctx.userId,
      type: "custom",
      title: content.slice(0, MEMORY_TITLE_MAX),
      content,
      source: "copilot",
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "save_failed" } as Failure;
  const id = String((data as { id: unknown }).id);
  return { memoryId: id, undo: { tool: "save_memory", id } };
}

async function draftEmail(input: z.infer<typeof draftEmailSchema>, env: CopilotToolEnv) {
  return saveArtifact(
    {
      kind: "email_draft",
      title: input.subject,
      content: { to: input.to ?? null, subject: input.subject, body: input.body },
      linkedRecordType: input.linkedRecordType,
      linkedRecordId: input.linkedRecordId,
    },
    env,
  );
}

async function createTask(input: z.infer<typeof createTaskSchema>, env: CopilotToolEnv) {
  if (!env.ctx.userId) return { ok: false, error: "no_user" } as Failure;
  const cap = env.ctx.isGuest ? TASK_CAPS.guestPerOrg : TASK_CAPS.perOrg;
  const { count, error: countError } = await env.db
    .from("copilot_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", env.ctx.orgId)
    .eq("is_active", true);
  if (countError) return { ok: false, error: countError.message } as Failure;
  if ((count ?? 0) >= cap) return { ok: false, error: "task_cap" } as Failure;

  const nextRun = computeNextRun(input.schedule, new Date());
  const { data, error } = await env.db
    .from("copilot_tasks")
    .insert({
      organization_id: env.ctx.orgId,
      user_id: env.ctx.userId,
      title: input.title,
      prompt: input.prompt,
      schedule: input.schedule,
      is_active: true,
      next_run_at: nextRun ? nextRun.toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "save_failed" } as Failure;
  return { taskId: String((data as { id: unknown }).id) };
}

export const copilotOnlyTools: RegistryTool[] = [
  {
    name: "save_artifact",
    description:
      "Save a draft, lead list, report or note the user can reopen later from the Copilot library. Content is a JSON object.",
    inputSchema: saveArtifactSchema,
    kind: "low_risk_write",
    execute: (input, env) => saveArtifact(saveArtifactSchema.parse(input), env),
  },
  {
    name: "save_memory",
    description: "Remember a short fact about the business or the user's preferences for future conversations.",
    inputSchema: saveMemorySchema,
    kind: "low_risk_write",
    execute: (input, env) => saveMemory(saveMemorySchema.parse(input), env),
  },
  {
    name: "draft_email",
    description: "Save an email draft for the user to review. This never sends anything.",
    inputSchema: draftEmailSchema,
    kind: "low_risk_write",
    execute: (input, env) => draftEmail(draftEmailSchema.parse(input), env),
  },
  {
    name: "create_task",
    description: "Schedule a recurring Copilot task (daily, weekly or monthly) that runs the given prompt.",
    inputSchema: createTaskSchema,
    kind: "write",
    execute: (input, env) => createTask(createTaskSchema.parse(input), env),
  },
  {
    name: "suggest_next",
    description:
      "Offer the user 1-4 clickable next steps under your reply (or the choices for a question you ask). Each option has a short button label and the full prompt sent when it is clicked. Call it last: it ends your turn. Writes nothing.",
    inputSchema: suggestNextSchema,
    kind: "read",
    execute: async () => ({ ok: true }),
  },
];
