// Runs the scheduled Copilot tasks that are due, from the daily-reset cron.
//
// Due tasks are served least-recently-run first (orderForFairness), at most
// TASK_CAPS.perOrgRunsPerInvocation per workspace, one at a time. A task only starts when a
// full per-task timeout still fits before `deadlineAt`; everything not started is counted as
// deferred. Deferred tasks stay due and, having the oldest last_run_at, are served first next time.
//
// The selection is a cross-org sweep (like expireApprovals); each run is scoped to its task's
// organization_id inside runCopilotTask, which also re-checks eligibility when it claims the task.
import type { SupabaseClient } from "@supabase/supabase-js";
import { runCopilotTask, type CopilotTaskRow } from "./run-task";
import { isDue, orderForFairness, TASK_CAPS } from "./schedule";

export type RunDueTasksResult = {
  attempted: number;
  done: number;
  skipped: number;
  failed: number;
  deferred: number;
};

async function selectDueTasks(admin: SupabaseClient, now: Date): Promise<CopilotTaskRow[]> {
  const { data, error } = await admin
    .from("copilot_tasks")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", now.toISOString());
  if (error) throw new Error(`selecting due tasks failed: ${error.message}`);
  return ((data ?? []) as CopilotTaskRow[]).filter((task) => isDue(task, now));
}

/** Splits fairness-ordered tasks into those to run now (per-org cap) and those over the cap. */
function applyPerOrgCap(tasks: CopilotTaskRow[]): { selected: CopilotTaskRow[]; overCap: number } {
  const perOrg = new Map<string, number>();
  const selected: CopilotTaskRow[] = [];
  for (const task of tasks) {
    const count = perOrg.get(task.organization_id) ?? 0;
    if (count >= TASK_CAPS.perOrgRunsPerInvocation) continue;
    perOrg.set(task.organization_id, count + 1);
    selected.push(task);
  }
  return { selected, overCap: tasks.length - selected.length };
}

export async function runDueTasks(args: {
  admin: SupabaseClient;
  now: Date;
  deadlineAt: number;
}): Promise<RunDueTasksResult> {
  const { admin, now, deadlineAt } = args;
  const { selected, overCap } = applyPerOrgCap(orderForFairness(await selectDueTasks(admin, now)));
  const result: RunDueTasksResult = { attempted: 0, done: 0, skipped: 0, failed: 0, deferred: overCap };

  for (let i = 0; i < selected.length; i++) {
    if (Date.now() + TASK_CAPS.perTaskTimeoutMs > deadlineAt) {
      result.deferred += selected.length - i;
      break;
    }
    const task = selected[i];
    result.attempted++;
    try {
      const run = await runCopilotTask({ task, deadlineAt, admin });
      result[run.status]++;
      if (run.status !== "done") {
        console.warn(`[run-due-tasks] task ${task.id} ${run.status}: ${run.reason ?? "unknown"}`);
      }
    } catch (e) {
      // runCopilotTask throws only when the claim query itself fails.
      result.failed++;
      console.error(`[run-due-tasks] task ${task.id} failed:`, e instanceof Error ? e.message : String(e));
    }
  }
  return result;
}
