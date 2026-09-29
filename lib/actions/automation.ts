"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getOrgId } from "./helpers";
import type { Json } from "@/types/database";
import {
  getICPGrade,
  type TriggerType,
  type Condition,
  type AutomationAction,
  type AutomationRule,
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
  const orgId = await getOrgId();
  let query = supabase
    .from("automation_executions")
    .select("*, automation_rules!inner(name, organization_id)")
    .eq("automation_rules.organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.ruleId) query = query.eq("rule_id", options.ruleId);
  if (options?.leadId) query = query.eq("lead_id", options.leadId);

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { data: data ?? [] };
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
