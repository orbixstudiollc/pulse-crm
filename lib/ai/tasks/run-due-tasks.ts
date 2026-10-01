// Runs the scheduled Copilot tasks that are due, from the daily-reset cron.
//
// Due tasks of non-guest workspaces are served before guest workspaces' (a guest is decided
// per org by sharedCallerIsGuest), each least-recently-run first (orderForFairness), at most
// TASK_CAPS.perOrgRunsPerInvocation per workspace and TASK_CAPS.guestRunsPerInvocation for all
// guest workspaces together, one at a time. A task only starts when a
// full per-task timeout still fits before `deadlineAt`; everything not started is counted as
// deferred. Deferred tasks stay due and, having the oldest last_run_at, are served first next time.
//
// The selection is a cross-org sweep (like expireApprovals); each run is scoped to its task's
// organization_id inside runCopilotTask, which also re-checks eligibility when it claims the task.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sharedCallerIsGuest } from "@/lib/ai/shared-budget";
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

/** The orgs among `tasks` that are guest workspaces (sharedCallerIsGuest; unknown counts as guest). */
async function guestOrgsOf(tasks: CopilotTaskRow[]): Promise<Set<string>> {
  const orgIds = Array.from(new Set(tasks.map((t) => t.organization_id)));
  const flags = await Promise.all(orgIds.map((orgId) => sharedCallerIsGuest(orgId)));
  return new Set(orgIds.filter((_, i) => flags[i]));
}

/**
 * Splits fairness-ordered tasks into those to run now and those over a cap: the per-org cap,
 * and TASK_CAPS.guestRunsPerInvocation across all guest workspaces.
 */
function applyCaps(
  tasks: CopilotTaskRow[],
  guestOrgs: ReadonlySet<string>,
): { selected: CopilotTaskRow[]; overCap: number } {
  const perOrg = new Map<string, number>();
  const selected: CopilotTaskRow[] = [];
  let guestRuns = 0;
  for (const task of tasks) {
    const count = perOrg.get(task.organization_id) ?? 0;
    if (count >= TASK_CAPS.perOrgRunsPerInvocation) continue;
    const isGuest = guestOrgs.has(task.organization_id);
    if (isGuest && guestRuns >= TASK_CAPS.guestRunsPerInvocation) continue;
    perOrg.set(task.organization_id, count + 1);
    if (isGuest) guestRuns++;
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
  const due = await selectDueTasks(admin, now);
  const guestOrgs = await guestOrgsOf(due);
  const { selected, overCap } = applyCaps(orderForFairness(due, guestOrgs), guestOrgs);
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
