import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import {
  evaluateConditions,
  matchTrigger,
  DEFAULT_RULE_TEMPLATES,
  type TriggerType,
  type TriggerEventData,
  type Condition,
  type AutomationAction,
  type LeadForEvaluation,
  type TriggerConfig,
} from "@/lib/automation/engine";
import { isAllowedLeadField } from "@/lib/automation/lead-fields";

type AdminClient = SupabaseClient<Database>;
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type ActionResult = { type: string; success: boolean; error?: string };

// ─── Core Engine ─────────────────────────────────────────────────────────────

export async function evaluateLeadAgainstRules(
  leadId: string,
  triggerType: TriggerType,
  eventData: TriggerEventData = {},
) {
  try {
    const admin = createAdminClient();

    // Fetch lead
    const { data: lead, error: leadError } = await admin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) return;

    // Fetch active rules for this org + trigger type
    const { data: rules, error: rulesError } = await admin
      .from("automation_rules")
      .select("*")
      .eq("organization_id", lead.organization_id)
      .eq("is_active", true)
      .eq("trigger_type", triggerType)
      .order("execution_order", { ascending: true });

    if (rulesError || !rules?.length) return;

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

    for (const rule of rules) {
      const triggerConfig = (rule.trigger_config || {}) as unknown as TriggerConfig;
      const conditions = (rule.conditions || []) as unknown as Condition[];
      const actions = (rule.actions || []) as unknown as AutomationAction[];

      // Check trigger match
      if (!matchTrigger(rule.trigger_type as TriggerType, triggerConfig, triggerType, eventData)) {
        continue;
      }

      // Check conditions
      if (!evaluateConditions(leadForEval, conditions)) {
        continue;
      }

      // Execute actions
      await executeRule(admin, rule.id, leadId, lead.organization_id, actions, triggerType, eventData);
    }
  } catch (err) {
    console.error("[automation] Error evaluating rules:", err);
  }
}

// ─── Rule Executor ───────────────────────────────────────────────────────────

async function executeRule(
  admin: AdminClient,
  ruleId: string,
  leadId: string,
  organizationId: string,
  actions: AutomationAction[],
  triggerType: TriggerType,
  triggerData: TriggerEventData,
) {
  const actionsExecuted = await executeAutomationActions(admin, organizationId, leadId, actions);

  // Log execution
  await admin.from("automation_executions").insert({
    rule_id: ruleId,
    lead_id: leadId,
    trigger_type: triggerType,
    trigger_data: triggerData as unknown as Json,
    actions_executed: actionsExecuted as unknown as Json,
    success: actionsExecuted.every((a) => a.success),
    error_message: actionsExecuted
      .filter((a) => !a.success)
      .map((a) => a.error)
      .join("; ") || null,
  });

  // Update rule execution timestamp
  await admin
    .from("automation_rules")
    .update({ last_executed_at: new Date().toISOString() })
    .eq("id", ruleId)
    .eq("organization_id", organizationId);

  // Increment execution_count (the SQL function is not in the generated Database types)
  await (admin as unknown as SupabaseClient).rpc("increment_automation_rule_count", {
    rule_id: ruleId,
  });
}

// ─── Action Executor ─────────────────────────────────────────────────────────

/** Insert a lead_activities row after confirming the lead belongs to the org. */
async function insertLeadActivity(
  admin: AdminClient,
  organizationId: string,
  leadId: string,
  activity: { type: string; title: string; description: string },
): Promise<string | null> {
  const { data: ownedLead } = await admin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!ownedLead) return "Lead not found in this organization";

  const { error } = await admin
    .from("lead_activities")
    .insert({ lead_id: leadId, type: activity.type, title: activity.title, description: activity.description });
  return error ? error.message : null;
}

export async function executeAutomationActions(
  admin: AdminClient,
  organizationId: string,
  leadId: string,
  actions: AutomationAction[],
  defaults?: { activityTitle?: string; activityDescription?: string },
): Promise<ActionResult[]> {
  const actionsExecuted: ActionResult[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "change_status": {
          const { error } = await admin
            .from("leads")
            .update({
              status: action.config.status,
              status_changed_at: new Date().toISOString(),
            } as LeadUpdate)
            .eq("id", leadId)
            .eq("organization_id", organizationId);
          if (error) throw new Error(error.message);
          actionsExecuted.push({ type: "change_status", success: true });
          break;
        }

        case "enroll_sequence": {
          let sequenceId = action.config.sequence_id as string;

          // Special: "__FIRST_ACTIVE__" finds the first active sequence
          if (sequenceId === "__FIRST_ACTIVE__") {
            const { data: seq } = await admin
              .from("sequences")
              .select("id")
              .eq("organization_id", organizationId)
              .eq("status", "active")
              .order("created_at", { ascending: true })
              .limit(1)
              .single();
            if (!seq) {
              actionsExecuted.push({
                type: "enroll_sequence",
                success: false,
                error: "No active sequence found",
              });
              break;
            }
            sequenceId = seq.id;
          }

          // SECURITY: never enroll a lead in a sequence from a different organization.
          const { data: ownedSeq } = await admin
            .from("sequences")
            .select("id")
            .eq("id", sequenceId)
            .eq("organization_id", organizationId)
            .maybeSingle();
          if (!ownedSeq) {
            actionsExecuted.push({
              type: "enroll_sequence",
              success: false,
              error: "Sequence not found in this organization",
            });
            break;
          }

          // Check if already enrolled
          const { data: existing } = await admin
            .from("sequence_enrollments")
            .select("id")
            .eq("sequence_id", sequenceId)
            .eq("lead_id", leadId)
            .eq("status", "active")
            .maybeSingle();

          if (!existing) {
            const { error } = await admin.from("sequence_enrollments").insert({
              sequence_id: sequenceId,
              lead_id: leadId,
              current_step: 0,
              status: "active",
            });
            if (error) throw new Error(error.message);
            actionsExecuted.push({ type: "enroll_sequence", success: true });
          } else {
            actionsExecuted.push({
              type: "enroll_sequence",
              success: false,
              error: "Already enrolled",
            });
          }
          break;
        }

        case "assign_to": {
          const userId = action.config.user_id;
          const { data: assignee } =
            typeof userId === "string" && userId
              ? await admin
                  .from("profiles")
                  .select("id")
                  .eq("id", userId)
                  .eq("organization_id", organizationId)
                  .maybeSingle()
              : { data: null };
          if (!assignee) {
            actionsExecuted.push({
              type: "assign_to",
              success: false,
              error: "Assignee not in organization",
            });
            break;
          }
          const { error } = await admin
            .from("leads")
            .update({ assigned_to: assignee.id } as LeadUpdate)
            .eq("id", leadId)
            .eq("organization_id", organizationId);
          if (error) throw new Error(error.message);
          actionsExecuted.push({ type: "assign_to", success: true });
          break;
        }

        case "update_field": {
          const field = action.config.field;
          if (!isAllowedLeadField(field)) {
            actionsExecuted.push({ type: "update_field", success: false, error: "Field not allowed" });
            break;
          }
          const { error } = await admin
            .from("leads")
            .update({ [field]: action.config.value } as LeadUpdate)
            .eq("id", leadId)
            .eq("organization_id", organizationId);
          if (error) throw new Error(error.message);
          actionsExecuted.push({ type: "update_field", success: true });
          break;
        }

        case "add_activity": {
          const activityError = await insertLeadActivity(admin, organizationId, leadId, {
            type: (action.config.type as string) || "note",
            title:
              (action.config.title as string) || defaults?.activityTitle || "Automation Activity",
            description:
              (action.config.description as string) || defaults?.activityDescription || "",
          });
          actionsExecuted.push(
            activityError
              ? { type: "add_activity", success: false, error: activityError }
              : { type: "add_activity", success: true },
          );
          break;
        }

        case "send_notification": {
          // No notifications table exists: record the notification as a lead activity.
          const notifyError = await insertLeadActivity(admin, organizationId, leadId, {
            type: "notification",
            title: (action.config.title as string) || "Notification",
            description: (action.config.message as string) || "",
          });
          actionsExecuted.push(
            notifyError
              ? { type: "send_notification", success: false, error: notifyError }
              : { type: "send_notification", success: true },
          );
          break;
        }

        case "add_tag": {
          const tag = String(action.config.tag ?? "").trim();
          if (!tag) {
            actionsExecuted.push({ type: "add_tag", success: false, error: "No tag configured" });
            break;
          }
          const { data: lead } = await admin
            .from("leads")
            .select("tags")
            .eq("id", leadId)
            .eq("organization_id", organizationId)
            .maybeSingle();
          if (!lead) {
            actionsExecuted.push({
              type: "add_tag",
              success: false,
              error: "Lead not found in this organization",
            });
            break;
          }
          const next = Array.from(new Set([...(lead.tags ?? []), tag]));
          const { error: tagError } = await admin
            .from("leads")
            .update({ tags: next })
            .eq("id", leadId)
            .eq("organization_id", organizationId);
          if (tagError) throw new Error(tagError.message);
          actionsExecuted.push({ type: "add_tag", success: true });
          break;
        }

        default:
          actionsExecuted.push({
            type: action.type,
            success: false,
            error: "Unknown action type",
          });
      }
    } catch (err) {
      actionsExecuted.push({
        type: action.type,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return actionsExecuted;
}

// ─── Seed Default Rules ──────────────────────────────────────────────────────

export async function seedDefaultRules(organizationId: string) {
  const admin = createAdminClient();

  // Check if rules already exist
  const { data: existing } = await admin
    .from("automation_rules")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1);

  if (existing && existing.length > 0) return;

  for (const template of DEFAULT_RULE_TEMPLATES) {
    await admin.from("automation_rules").insert({
      organization_id: organizationId,
      name: template.name,
      description: template.description,
      is_active: false, // Seeded as inactive — user enables manually
      trigger_type: template.trigger_type,
      trigger_config: template.trigger_config as unknown as Json,
      conditions: template.conditions as unknown as Json,
      actions: template.actions as unknown as Json,
      execution_order: template.execution_order,
    });
  }
}
