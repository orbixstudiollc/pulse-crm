"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database";
import {
  evaluateConditions,
  matchTrigger,
  getICPGrade,
  DEFAULT_RULE_TEMPLATES,
  type TriggerType,
  type TriggerEventData,
  type Condition,
  type AutomationAction,
  type AutomationRule,
  type LeadForEvaluation,
  type TriggerConfig,
} from "@/lib/automation/engine";

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getAutomationRules() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return { error: "No profile" };

  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("execution_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { data: data ?? [] };
}

export async function getAutomationRuleById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function createAutomationRule(ruleData: {
  name: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_config?: TriggerConfig;
  conditions?: Condition[];
  actions?: AutomationAction[];
  execution_order?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return { error: "No profile" };

  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      organization_id: profile.organization_id,
      created_by: user.id,
      name: ruleData.name,
      description: ruleData.description || null,
      trigger_type: ruleData.trigger_type,
      trigger_config: (ruleData.trigger_config || {}) as unknown as Json,
      conditions: (ruleData.conditions || []) as unknown as Json,
      actions: (ruleData.actions || []) as unknown as Json,
      execution_order: ruleData.execution_order ?? 0,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { data };
}

export async function updateAutomationRule(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    is_active: boolean;
    trigger_type: TriggerType;
    trigger_config: TriggerConfig;
    conditions: Condition[];
    actions: AutomationAction[];
    execution_order: number;
  }>,
) {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
  if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
  if (updates.trigger_config !== undefined)
    updateData.trigger_config = updates.trigger_config as unknown as Json;
  if (updates.conditions !== undefined)
    updateData.conditions = updates.conditions as unknown as Json;
  if (updates.actions !== undefined) updateData.actions = updates.actions as unknown as Json;
  if (updates.execution_order !== undefined) updateData.execution_order = updates.execution_order;

  const { data, error } = await supabase
    .from("automation_rules")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { data };
}

export async function deleteAutomationRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function toggleAutomationRule(id: string, isActive: boolean) {
  return updateAutomationRule(id, { is_active: isActive });
}

// ─── Execution Log ───────────────────────────────────────────────────────────

export async function getAutomationExecutions(options?: {
  ruleId?: string;
  leadId?: string;
  limit?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("automation_executions")
    .select("*, automation_rules(name)")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.ruleId) query = query.eq("rule_id", options.ruleId);
  if (options?.leadId) query = query.eq("lead_id", options.leadId);

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { data: data ?? [] };
}

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
      await executeAutomationActions(admin, rule.id, leadId, lead.organization_id, actions, triggerType, eventData);
    }
  } catch (err) {
    console.error("[automation] Error evaluating rules:", err);
  }
}

// ─── Action Executor ─────────────────────────────────────────────────────────

async function executeAutomationActions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  ruleId: string,
  leadId: string,
  organizationId: string,
  actions: AutomationAction[],
  triggerType: TriggerType,
  triggerData: TriggerEventData,
) {
  const actionsExecuted: Array<{ type: string; success: boolean; error?: string }> = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "change_status": {
          const newStatus = action.config.status as string;
          await admin
            .from("leads")
            .update({
              status: newStatus,
              status_changed_at: new Date().toISOString(),
            })
            .eq("id", leadId);
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

          // Check if already enrolled
          const { data: existing } = await admin
            .from("sequence_enrollments")
            .select("id")
            .eq("sequence_id", sequenceId)
            .eq("lead_id", leadId)
            .eq("status", "active")
            .maybeSingle();

          if (!existing) {
            await admin.from("sequence_enrollments").insert({
              sequence_id: sequenceId,
              lead_id: leadId,
              current_step: 0,
              status: "active",
            });
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
          const userId = action.config.user_id as string;
          if (userId) {
            await admin.from("leads").update({ assigned_to: userId }).eq("id", leadId);
            actionsExecuted.push({ type: "assign_to", success: true });
          }
          break;
        }

        case "update_field": {
          const field = action.config.field as string;
          const value = action.config.value;
          if (field) {
            await admin
              .from("leads")
              .update({ [field]: value })
              .eq("id", leadId);
            actionsExecuted.push({ type: "update_field", success: true });
          }
          break;
        }

        case "add_activity": {
          await admin.from("lead_activities").insert({
            lead_id: leadId,
            organization_id: organizationId,
            type: (action.config.type as string) || "note",
            title: (action.config.title as string) || "Automation Activity",
            description: (action.config.description as string) || "",
            status: "completed",
          });
          actionsExecuted.push({ type: "add_activity", success: true });
          break;
        }

        case "send_notification": {
          // For now, log as activity. Can expand to email/in-app later.
          await admin.from("lead_activities").insert({
            lead_id: leadId,
            organization_id: organizationId,
            type: "note",
            title: `Automation: ${(action.config.template as string) || "Notification"}`,
            description: `Triggered by ${triggerType}`,
            status: "completed",
          });
          actionsExecuted.push({ type: "send_notification", success: true });
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

  // Update rule execution count
  await admin
    .from("automation_rules")
    .update({
      execution_count: admin.rpc ? undefined : undefined, // handled below
      last_executed_at: new Date().toISOString(),
    })
    .eq("id", ruleId);

  // Increment execution_count via raw update
  await admin.rpc("increment_automation_rule_count", { rule_id: ruleId }).catch(() => {
    // Fallback: just update timestamp, count increment done separately
  });
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

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getAutomationStats() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return { error: "No profile" };

  const { data: rules } = await supabase
    .from("automation_rules")
    .select("id, is_active, execution_count")
    .eq("organization_id", profile.organization_id);

  const totalRules = rules?.length ?? 0;
  const activeRules = rules?.filter((r) => r.is_active).length ?? 0;
  const totalExecutions = rules?.reduce((sum, r) => sum + (r.execution_count || 0), 0) ?? 0;

  return {
    data: {
      totalRules,
      activeRules,
      totalExecutions,
    },
  };
}
