import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  evaluateConditions,
  type Condition,
  type AutomationAction,
  type LeadForEvaluation,
  type TriggerConfig,
} from "@/lib/automation/engine";
import { executeAutomationActions } from "@/lib/automation/runner";
import { verifyCronRequest } from "@/lib/security";

/**
 * Automation Executor Cron — runs hourly.
 * Evaluates time-based automation rules (e.g., days_in_status).
 */
export async function GET(request: Request) {
  const authErr = verifyCronRequest(request);
  if (authErr) return authErr;

  const admin = createAdminClient();
  let rulesProcessed = 0;
  let leadsActioned = 0;

  try {
    // Fetch all active time-based rules
    const { data: rules, error } = await admin
      .from("automation_rules")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_type", "days_in_status");

    if (error || !rules?.length) {
      return NextResponse.json({ rulesProcessed: 0, leadsActioned: 0 });
    }

    for (const rule of rules) {
      rulesProcessed++;
      const triggerConfig = (rule.trigger_config || {}) as unknown as TriggerConfig;
      const conditions = (rule.conditions || []) as unknown as Condition[];
      const actions = (rule.actions || []) as unknown as AutomationAction[];

      const targetStatus = triggerConfig.status;
      const targetDays = triggerConfig.days || 14;

      if (!targetStatus) continue;

      // Find leads that have been in the target status for at least N days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - targetDays);

      const { data: leads } = await admin
        .from("leads")
        .select("*")
        .eq("organization_id", rule.organization_id)
        .eq("status", targetStatus as "hot" | "warm" | "cold")
        .lt("status_changed_at", cutoffDate.toISOString());

      if (!leads?.length) continue;

      for (const lead of leads) {
        const leadForEval: LeadForEvaluation = {
          id: lead.id,
          status: lead.status,
          source: lead.source,
          score: lead.score,
          icp_match_score: lead.icp_match_score,
          qualification_grade: lead.qualification_grade,
          qualification_score: lead.qualification_score,
          industry: lead.industry,
          company: lead.company,
          employees: lead.employees,
          estimated_value: lead.estimated_value,
          engagement_score: lead.engagement_score,
          days_in_pipeline: lead.days_in_pipeline,
          assigned_to: (lead as Record<string, unknown>).assigned_to as string | null,
          location: lead.location,
        };

        if (!evaluateConditions(leadForEval, conditions)) continue;

        // Check if this rule already executed for this lead recently (last 24h)
        const { data: recentExec } = await admin
          .from("automation_executions")
          .select("id")
          .eq("rule_id", rule.id)
          .eq("lead_id", lead.id)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (recentExec?.length) continue;

        // Execute actions
        const results = await executeAutomationActions(admin, rule.organization_id, lead.id, actions, {
          activityTitle: "Automation: Time-based trigger",
          activityDescription: `Lead in ${targetStatus} for ${targetDays}+ days`,
        });

        // Log execution (recorded even when every action failed, so dedupe stops retries)
        await admin.from("automation_executions").insert({
          rule_id: rule.id,
          lead_id: lead.id,
          trigger_type: "days_in_status",
          trigger_data: { status: targetStatus, days: targetDays },
          actions_executed: results,
          success: results.every((r) => r.success),
          error_message:
            results
              .filter((r) => !r.success)
              .map((r) => r.error)
              .join("; ") || null,
        });

        // Update rule stats
        await admin
          .from("automation_rules")
          .update({ execution_count: (rule.execution_count || 0) + 1 })
          .eq("id", rule.id);
        await admin
          .from("automation_rules")
          .update({ last_executed_at: new Date().toISOString() })
          .eq("id", rule.id);

        leadsActioned++;
      }
    }
  } catch (err) {
    console.error("[automation-cron] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ rulesProcessed, leadsActioned });
}
