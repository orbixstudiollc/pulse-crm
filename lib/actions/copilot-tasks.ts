"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { computeNextRun, TASK_CAPS } from "@/lib/ai/tasks/schedule";
import { getCurrentUserProfile, getOrgId } from "./helpers";

// Scheduled Copilot tasks created from the composer. Every query is scoped by organization_id.

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(4000),
  schedule: z.enum(["daily", "weekly", "monthly"]),
});

export type CreateTaskResult =
  | { ok: true; id: string; nextRunAt: string }
  | { ok: false; error: "task_cap" | "invalid" };

export async function createTaskFromPrompt(input: {
  title: string;
  prompt: string;
  schedule: "daily" | "weekly" | "monthly";
}): Promise<CreateTaskResult> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const task = parsed.data;

  const { user } = await getCurrentUserProfile();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const cap = user.is_anonymous === true ? TASK_CAPS.guestPerOrg : TASK_CAPS.perOrg;

  const { count, error: countError } = await supabase
    .from("copilot_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_active", true);
  if (countError) throw new Error(`createTaskFromPrompt failed: ${countError.message}`);
  if ((count ?? 0) >= cap) return { ok: false, error: "task_cap" };

  const nextRun = computeNextRun(task.schedule, new Date());
  if (!nextRun) return { ok: false, error: "invalid" };

  const { data, error } = await supabase
    .from("copilot_tasks")
    .insert({
      organization_id: orgId,
      user_id: user.id,
      title: task.title,
      prompt: task.prompt,
      schedule: task.schedule,
      is_active: true,
      next_run_at: nextRun.toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createTaskFromPrompt failed: ${error?.message ?? "no row returned"}`);

  return { ok: true, id: data.id, nextRunAt: nextRun.toISOString() };
}
