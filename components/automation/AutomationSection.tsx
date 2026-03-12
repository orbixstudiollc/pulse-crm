"use client";

import { useState, useEffect, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Toggle,
  Badge,
  PlusIcon,
  TrashIcon,
  LightningIcon,
  CircleNotchIcon,
  CheckIcon,
  XIcon,
  CaretDownIcon,
} from "@/components/ui";
import {
  getAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  toggleAutomationRule,
  getAutomationExecutions,
  seedDefaultRules,
  getAutomationStats,
} from "@/lib/actions/automation";
import type {
  TriggerType,
  Condition,
  ConditionOperator,
  AutomationAction,
  ActionType,
} from "@/lib/automation/engine";

// ─── Shared Styles ──────────────────────────────────────────────────────────

const selectClass =
  "rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 pl-3 pr-8 py-2 text-sm text-neutral-950 dark:text-neutral-50 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.25rem_1.25rem]";

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string }[] = [
  { value: "lead_created", label: "Lead Created", description: "When a new lead is added" },
  { value: "lead_updated", label: "Lead Updated", description: "When a lead field changes" },
  { value: "score_changed", label: "Score Changed", description: "After lead scoring runs" },
  { value: "icp_graded", label: "ICP Graded", description: "After ICP matching completes" },
  { value: "qualification_changed", label: "Qualification Changed", description: "After qualification update" },
  { value: "email_replied", label: "Email Replied", description: "When a lead replies to an email" },
  { value: "email_opened", label: "Email Opened", description: "When a lead opens an email" },
  { value: "email_bounced", label: "Email Bounced", description: "When an email bounces" },
  { value: "days_in_status", label: "Days in Status", description: "Lead in same status for X days" },
];

const CONDITION_FIELDS = [
  { value: "status", label: "Status", type: "select", options: ["cold", "warm", "hot"] },
  { value: "source", label: "Source", type: "select", options: ["Website", "Referral", "LinkedIn", "Event", "Google Ads", "Cold Call"] },
  { value: "score", label: "Score", type: "number" },
  { value: "icp_match_score", label: "ICP Score", type: "number" },
  { value: "qualification_grade", label: "Qualification Grade", type: "select", options: ["A", "B", "C", "D"] },
  { value: "industry", label: "Industry", type: "text" },
  { value: "employees", label: "Employees", type: "text" },
  { value: "estimated_value", label: "Estimated Value", type: "number" },
  { value: "engagement_score", label: "Engagement Score", type: "number" },
  { value: "days_in_pipeline", label: "Days in Pipeline", type: "number" },
];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less or equal" },
  { value: "in", label: "in list" },
  { value: "contains", label: "contains" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "change_status", label: "Change Status" },
  { value: "enroll_sequence", label: "Enroll in Sequence" },
  { value: "assign_to", label: "Assign to User" },
  { value: "update_field", label: "Update Field" },
  { value: "add_activity", label: "Add Activity" },
  { value: "send_notification", label: "Send Notification" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface RuleRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Condition[];
  actions: AutomationAction[];
  execution_count: number;
  last_executed_at: string | null;
  execution_order: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AutomationSection() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [stats, setStats] = useState({ totalRules: 0, activeRules: 0, totalExecutions: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);
  const [activeView, setActiveView] = useState<"rules" | "log">("rules");
  const [executions, setExecutions] = useState<Array<Record<string, unknown>>>([]);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadRules = () => {
    startTransition(async () => {
      const res = await getAutomationRules();
      if (res.data) {
        setRules(
          res.data.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            name: r.name as string,
            description: r.description as string | null,
            is_active: r.is_active as boolean,
            trigger_type: r.trigger_type as string,
            trigger_config: (r.trigger_config || {}) as Record<string, unknown>,
            conditions: (r.conditions || []) as Condition[],
            actions: (r.actions || []) as AutomationAction[],
            execution_count: r.execution_count as number,
            last_executed_at: r.last_executed_at as string | null,
            execution_order: r.execution_order as number,
          })),
        );
      }
      const statsRes = await getAutomationStats();
      if (statsRes.data) setStats(statsRes.data);
    });
  };

  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleAutomationRule(id, isActive);
    loadRules();
  };

  const handleDelete = async (id: string) => {
    await deleteAutomationRule(id);
    loadRules();
    setToast({ message: "Rule deleted", type: "success" });
  };

  const handleSeedDefaults = async () => {
    // Get org ID from any existing rule or fetch it
    startTransition(async () => {
      const res = await getAutomationRules();
      if (res.error) {
        setToast({ message: "Failed to seed defaults", type: "error" });
        return;
      }
      // seedDefaultRules needs org_id, but we trigger it through the action
      // For now, we'll create rules through the UI
      setToast({ message: "Use 'Create Rule' to add automation rules", type: "success" });
    });
  };

  const loadExecutions = () => {
    startTransition(async () => {
      const res = await getAutomationExecutions({ limit: 50 });
      if (res.data) setExecutions(res.data as Array<Record<string, unknown>>);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
        <div>
          <h2 className="text-[28px] leading-[36px] tracking-[-0.56px] font-serif text-neutral-950 dark:text-neutral-50">
            Automation Rules
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Automate lead management with trigger-based rules.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
          <div className="flex items-start justify-between p-5">
            <div className="space-y-2">
              <p className="text-xs font-normal uppercase leading-5 text-neutral-500 dark:text-neutral-400">Total Rules</p>
              <p className="text-[32px] leading-[40px] tracking-[-0.64px] font-serif text-neutral-950 dark:text-neutral-50">{stats.totalRules}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800">
              <LightningIcon size={20} className="text-neutral-950 dark:text-neutral-50" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
          <div className="flex items-start justify-between p-5">
            <div className="space-y-2">
              <p className="text-xs font-normal uppercase leading-5 text-neutral-500 dark:text-neutral-400">Active</p>
              <p className="text-[32px] leading-[40px] tracking-[-0.64px] font-serif text-[#00a63e] dark:text-green-400">{stats.activeRules}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800">
              <CheckIcon size={20} className="text-[#00a63e] dark:text-green-400" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
          <div className="flex items-start justify-between p-5">
            <div className="space-y-2">
              <p className="text-xs font-normal uppercase leading-5 text-neutral-500 dark:text-neutral-400">Executions</p>
              <p className="text-[32px] leading-[40px] tracking-[-0.64px] font-serif text-neutral-950 dark:text-neutral-50">{stats.totalExecutions}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800">
              <CircleNotchIcon size={20} className="text-neutral-950 dark:text-neutral-50" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveView("rules")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeView === "rules"
              ? "border-neutral-950 dark:border-neutral-50 text-neutral-950 dark:text-neutral-50"
              : "border-transparent text-neutral-500 hover:text-neutral-700",
          )}
        >
          Rules
        </button>
        <button
          onClick={() => {
            setActiveView("log");
            loadExecutions();
          }}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeView === "log"
              ? "border-neutral-950 dark:border-neutral-50 text-neutral-950 dark:text-neutral-50"
              : "border-transparent text-neutral-500 hover:text-neutral-700",
          )}
        >
          Execution Log
        </button>
      </div>

      {activeView === "rules" ? (
        <>
          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button onClick={() => { setEditingRule(null); setShowCreate(true); }}>
              <PlusIcon size={16} className="mr-1.5" />
              Create Rule
            </Button>
          </div>

          {/* Rules List */}
          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <LightningIcon size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No automation rules yet.</p>
                <p className="text-xs mt-1">Create your first rule to automate lead management.</p>
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Toggle
                      enabled={rule.is_active}
                      onChange={(enabled) => handleToggle(rule.id, enabled)}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                          {rule.name}
                        </p>
                        <Badge variant={rule.is_active ? "green" : "neutral"}>
                          {rule.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 truncate">
                        {rule.description || TRIGGER_OPTIONS.find((t) => t.value === rule.trigger_type)?.description || rule.trigger_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-neutral-500">{rule.execution_count} runs</p>
                      {rule.last_executed_at && (
                        <p className="text-xs text-neutral-400">
                          Last: {new Date(rule.last_executed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingRule(rule); setShowCreate(true); }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Execution Log */
        <div className="space-y-2">
          {executions.length === 0 ? (
            <p className="text-center py-8 text-sm text-neutral-500">No executions yet.</p>
          ) : (
            executions.map((exec) => (
              <div
                key={exec.id as string}
                className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      exec.success ? "bg-green-500" : "bg-red-500",
                    )}
                  />
                  <span className="text-neutral-950 dark:text-neutral-50">
                    {(exec.automation_rules as Record<string, unknown>)?.name as string || "Rule"}
                  </span>
                  <Badge variant="neutral">{exec.trigger_type as string}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  {exec.error_message ? (
                    <span className="text-red-500 truncate max-w-[200px]">{String(exec.error_message)}</span>
                  ) : null}
                  <span>{new Date(exec.created_at as string).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <RuleEditor
          rule={editingRule}
          onSave={() => {
            setShowCreate(false);
            setEditingRule(null);
            loadRules();
            setToast({ message: editingRule ? "Rule updated" : "Rule created", type: "success" });
          }}
          onClose={() => {
            setShowCreate(false);
            setEditingRule(null);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={cn(
              "px-4 py-2 rounded text-sm font-medium shadow-lg",
              toast.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white",
            )}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rule Editor Modal ───────────────────────────────────────────────────────

function RuleEditor({
  rule,
  onSave,
  onClose,
}: {
  rule: RuleRow | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [triggerType, setTriggerType] = useState<TriggerType>(
    (rule?.trigger_type as TriggerType) || "lead_created",
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    rule?.trigger_config || {},
  );
  const [conditions, setConditions] = useState<Condition[]>(rule?.conditions || []);
  const [actions, setActions] = useState<AutomationAction[]>(
    rule?.actions || [{ type: "change_status", config: { status: "warm" } }],
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    try {
      if (rule) {
        await updateAutomationRule(rule.id, {
          name,
          description: description || null,
          trigger_type: triggerType,
          trigger_config: triggerConfig as Record<string, unknown>,
          conditions,
          actions,
        });
      } else {
        await createAutomationRule({
          name,
          description: description || undefined,
          trigger_type: triggerType,
          trigger_config: triggerConfig as Record<string, unknown>,
          conditions,
          actions,
        });
      }
      onSave();
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: "score", operator: "gte", value: 50 }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const addAction = () => {
    setActions([...actions, { type: "change_status", config: { status: "warm" } }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updates: Partial<AutomationAction>) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            {rule ? "Edit Rule" : "Create Automation Rule"}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <XIcon size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name & Description */}
          <div className="space-y-3">
            <Input
              label="Rule Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-warm high scorers"
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2">
              TRIGGER — When should this rule fire?
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              className={cn(selectClass, "w-full py-2.5")}
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} — {t.description}
                </option>
              ))}
            </select>

            {/* Trigger-specific config */}
            {triggerType === "score_changed" && (
              <div className="mt-3 flex items-center gap-3">
                <select
                  value={(triggerConfig.direction as string) || "increased"}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, direction: e.target.value })}
                  className={selectClass}
                >
                  <option value="increased">Score Increased</option>
                  <option value="decreased">Score Decreased</option>
                </select>
                <Input
                  placeholder="Min threshold"
                  type="number"
                  value={String(triggerConfig.threshold || "")}
                  onChange={(e) =>
                    setTriggerConfig({ ...triggerConfig, threshold: Number(e.target.value) || undefined })
                  }
                />
              </div>
            )}

            {triggerType === "icp_graded" && (
              <div className="mt-3">
                <p className="text-xs text-neutral-500 mb-1">Trigger for grades:</p>
                <div className="flex gap-2">
                  {["A+", "A", "B", "C", "D"].map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        const current = (triggerConfig.grades as string[]) || [];
                        const updated = current.includes(g)
                          ? current.filter((x) => x !== g)
                          : [...current, g];
                        setTriggerConfig({ ...triggerConfig, grades: updated });
                      }}
                      className={cn(
                        "px-3 py-1 rounded text-xs font-medium border transition-colors",
                        ((triggerConfig.grades as string[]) || []).includes(g)
                          ? "bg-neutral-950 text-white border-neutral-950 dark:bg-neutral-50 dark:text-neutral-950"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-500",
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {triggerType === "days_in_status" && (
              <div className="mt-3 flex items-center gap-3">
                <select
                  value={(triggerConfig.status as string) || "cold"}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, status: e.target.value })}
                  className={selectClass}
                >
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                </select>
                <span className="text-sm text-neutral-500">for</span>
                <Input
                  type="number"
                  placeholder="Days"
                  value={String(triggerConfig.days || "")}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, days: Number(e.target.value) || undefined })}
                  className="w-24"
                />
                <span className="text-sm text-neutral-500">days</span>
              </div>
            )}
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-neutral-500">
                CONDITIONS — Additional filters (all must match)
              </label>
              <Button variant="ghost" size="sm" onClick={addCondition}>
                <PlusIcon size={14} className="mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={cond.field}
                    onChange={(e) => updateCondition(i, { field: e.target.value })}
                    className={cn(selectClass, "flex-1")}
                  >
                    {CONDITION_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionOperator })}
                    className={selectClass}
                  >
                    {OPERATORS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {cond.operator !== "is_empty" && cond.operator !== "is_not_empty" && (
                    <input
                      value={String(cond.value || "")}
                      onChange={(e) => updateCondition(i, { value: e.target.value })}
                      className={cn(selectClass, "flex-1")}
                      placeholder="Value"
                    />
                  )}
                  <button onClick={() => removeCondition(i)} className="text-neutral-400 hover:text-red-500">
                    <XIcon size={16} />
                  </button>
                </div>
              ))}
              {conditions.length === 0 && (
                <p className="text-xs text-neutral-400 italic">No conditions — rule fires for all matching triggers.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-neutral-500">
                ACTIONS — What should happen?
              </label>
              <Button variant="ghost" size="sm" onClick={addAction}>
                <PlusIcon size={14} className="mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={action.type}
                    onChange={(e) => updateAction(i, { type: e.target.value as ActionType, config: {} })}
                    className={selectClass}
                  >
                    {ACTION_OPTIONS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>

                  {/* Action-specific config */}
                  {action.type === "change_status" && (
                    <select
                      value={(action.config.status as string) || "warm"}
                      onChange={(e) => updateAction(i, { config: { status: e.target.value } })}
                      className={cn(selectClass, "flex-1")}
                    >
                      <option value="cold">Cold</option>
                      <option value="warm">Warm</option>
                      <option value="hot">Hot</option>
                    </select>
                  )}

                  {action.type === "enroll_sequence" && (
                    <input
                      value={(action.config.sequence_id as string) || ""}
                      onChange={(e) => updateAction(i, { config: { sequence_id: e.target.value } })}
                      className={cn(selectClass, "flex-1")}
                      placeholder="Sequence ID (or __FIRST_ACTIVE__)"
                    />
                  )}

                  {action.type === "update_field" && (
                    <>
                      <input
                        value={(action.config.field as string) || ""}
                        onChange={(e) => updateAction(i, { config: { ...action.config, field: e.target.value } })}
                        className={cn(selectClass, "flex-1")}
                        placeholder="Field name"
                      />
                      <input
                        value={String(action.config.value || "")}
                        onChange={(e) => updateAction(i, { config: { ...action.config, value: e.target.value } })}
                        className={cn(selectClass, "flex-1")}
                        placeholder="Value"
                      />
                    </>
                  )}

                  <button onClick={() => removeAction(i)} className="text-neutral-400 hover:text-red-500">
                    <XIcon size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? (
              <CircleNotchIcon size={16} className="animate-spin mr-1.5" />
            ) : null}
            {rule ? "Update Rule" : "Create Rule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
