/**
 * Automation Rules Engine — Pure logic for evaluating conditions and matching triggers.
 * No server directive — imported by server actions.
 */

import type { Json } from "@/types/database";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TriggerType =
  | "lead_created"
  | "lead_updated"
  | "score_changed"
  | "icp_graded"
  | "qualification_changed"
  | "email_opened"
  | "email_replied"
  | "email_bounced"
  | "days_in_status"
  | "website_visit";

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "is_empty"
  | "is_not_empty";

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export type ActionType =
  | "change_status"
  | "enroll_sequence"
  | "assign_to"
  | "send_notification"
  | "update_field"
  | "add_activity"
  | "add_tag";

export interface AutomationAction {
  type: ActionType;
  config: Record<string, unknown>;
}

export interface TriggerConfig {
  field?: string;
  operator?: string;
  value?: unknown;
  direction?: "increased" | "decreased";
  threshold?: number;
  grades?: string[];
  grade?: string;
  event_type?: string;
  days?: number;
  status?: string;
  page_pattern?: string;
  changed_fields?: string[];
}

export interface AutomationRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  conditions: Condition[];
  actions: AutomationAction[];
  execution_count: number;
  last_executed_at: string | null;
  execution_order: number;
}

export interface TriggerEventData {
  changed_fields?: string[];
  old_score?: number;
  new_score?: number;
  grade?: string;
  event_type?: string;
  intent?: string;
  page_url?: string;
  [key: string]: unknown;
}

// Lead type for evaluation (partial — only what we need)
export interface LeadForEvaluation {
  id: string;
  status: string;
  source: string;
  score: number;
  icp_match_score: number | null;
  qualification_grade: string | null;
  qualification_score: number | null;
  industry: string | null;
  company: string | null;
  employees: string | null;
  estimated_value: number;
  engagement_score: number;
  days_in_pipeline: number;
  assigned_to: string | null;
  location: string | null;
  [key: string]: unknown;
}

// ─── Trigger Matching ────────────────────────────────────────────────────────

export function matchTrigger(
  ruleTriggerType: TriggerType,
  triggerConfig: TriggerConfig,
  incomingTriggerType: TriggerType,
  eventData: TriggerEventData,
): boolean {
  if (ruleTriggerType !== incomingTriggerType) return false;

  switch (ruleTriggerType) {
    case "lead_created":
      return true;

    case "lead_updated": {
      if (triggerConfig.field && eventData.changed_fields) {
        return eventData.changed_fields.includes(triggerConfig.field);
      }
      return true;
    }

    case "score_changed": {
      const newScore = eventData.new_score ?? 0;
      const oldScore = eventData.old_score ?? 0;
      if (triggerConfig.direction === "increased" && newScore <= oldScore) return false;
      if (triggerConfig.direction === "decreased" && newScore >= oldScore) return false;
      if (triggerConfig.threshold != null && newScore < triggerConfig.threshold) return false;
      return true;
    }

    case "icp_graded": {
      if (triggerConfig.grades && eventData.grade) {
        return triggerConfig.grades.includes(eventData.grade);
      }
      return true;
    }

    case "qualification_changed": {
      if (triggerConfig.grade && eventData.grade) {
        return eventData.grade === triggerConfig.grade;
      }
      return true;
    }

    case "email_opened":
    case "email_replied":
    case "email_bounced":
      return true;

    case "days_in_status":
      // Time-based rules are evaluated by the cron job, not event-driven
      return true;

    case "website_visit": {
      if (triggerConfig.page_pattern && eventData.page_url) {
        return eventData.page_url.includes(triggerConfig.page_pattern);
      }
      return true;
    }

    default:
      return false;
  }
}

// ─── Condition Evaluation ────────────────────────────────────────────────────

function getFieldValue(lead: LeadForEvaluation, field: string): unknown {
  return lead[field] ?? null;
}

function compareValues(actual: unknown, operator: ConditionOperator, expected: unknown): boolean {
  switch (operator) {
    case "eq":
      return String(actual) === String(expected);

    case "neq":
      return String(actual) !== String(expected);

    case "gt":
      return Number(actual) > Number(expected);

    case "gte":
      return Number(actual) >= Number(expected);

    case "lt":
      return Number(actual) < Number(expected);

    case "lte":
      return Number(actual) <= Number(expected);

    case "in": {
      const arr = Array.isArray(expected) ? expected : String(expected).split(",").map((s) => s.trim());
      return arr.includes(String(actual));
    }

    case "not_in": {
      const arr = Array.isArray(expected) ? expected : String(expected).split(",").map((s) => s.trim());
      return !arr.includes(String(actual));
    }

    case "contains":
      return String(actual).toLowerCase().includes(String(expected).toLowerCase());

    case "is_empty":
      return actual == null || actual === "" || actual === 0;

    case "is_not_empty":
      return actual != null && actual !== "" && actual !== 0;

    default:
      return false;
  }
}

export function evaluateConditions(lead: LeadForEvaluation, conditions: Condition[]): boolean {
  if (!conditions || conditions.length === 0) return true;

  // All conditions must match (AND logic)
  return conditions.every((condition) => {
    const actual = getFieldValue(lead, condition.field);
    return compareValues(actual, condition.operator, condition.value);
  });
}

// ─── ICP Grade Helper ────────────────────────────────────────────────────────

export function getICPGrade(score: number | null): string {
  if (score == null) return "D";
  if (score >= 90) return "A+";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

// ─── Default Rule Templates ──────────────────────────────────────────────────

export interface DefaultRuleTemplate {
  name: string;
  description: string;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  conditions: Condition[];
  actions: AutomationAction[];
  execution_order: number;
}

export const DEFAULT_RULE_TEMPLATES: DefaultRuleTemplate[] = [
  {
    name: "Cold → Warm (Score + ICP)",
    description: "Move leads to warm when score ≥ 50 and ICP match ≥ 60",
    trigger_type: "score_changed",
    trigger_config: { direction: "increased", threshold: 50 },
    conditions: [
      { field: "status", operator: "eq", value: "cold" },
      { field: "score", operator: "gte", value: 50 },
      { field: "icp_match_score", operator: "gte", value: 60 },
    ],
    actions: [{ type: "change_status", config: { status: "warm" } }],
    execution_order: 1,
  },
  {
    name: "Warm → Hot (Email Reply + High Score)",
    description: "Move leads to hot when they reply to an email and have score ≥ 70",
    trigger_type: "email_replied",
    trigger_config: {},
    conditions: [
      { field: "status", operator: "eq", value: "warm" },
      { field: "score", operator: "gte", value: 70 },
    ],
    actions: [{ type: "change_status", config: { status: "hot" } }],
    execution_order: 2,
  },
  {
    name: "Auto-Enroll High ICP Leads",
    description: "Enroll new leads with ICP grade A+ or A into cold outreach sequence",
    trigger_type: "icp_graded",
    trigger_config: { grades: ["A+", "A"] },
    conditions: [{ field: "status", operator: "in", value: "cold,warm" }],
    actions: [{ type: "enroll_sequence", config: { sequence_id: "__FIRST_ACTIVE__" } }],
    execution_order: 3,
  },
];
