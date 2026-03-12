/**
 * Personalization Merge Engine
 * Resolves {{variables}} and {{#if conditions}} in email templates.
 */

import { createAdminClient } from "@/lib/supabase/server";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MergeField {
  key: string;
  label: string;
  category: "lead" | "contact" | "sender" | "system" | "custom";
  example?: string;
}

interface MergeContext {
  [key: string]: string | number | null | undefined;
}

// ─── Built-in Merge Fields ───────────────────────────────────────────────────

export const BUILT_IN_MERGE_FIELDS: MergeField[] = [
  // Lead fields
  { key: "first_name", label: "First Name", category: "lead", example: "John" },
  { key: "last_name", label: "Last Name", category: "lead", example: "Doe" },
  { key: "full_name", label: "Full Name", category: "lead", example: "John Doe" },
  { key: "name", label: "Name", category: "lead", example: "John Doe" },
  { key: "company", label: "Company", category: "lead", example: "Acme Inc" },
  { key: "email", label: "Email", category: "lead", example: "john@acme.com" },
  { key: "industry", label: "Industry", category: "lead", example: "Technology" },
  { key: "website", label: "Website", category: "lead", example: "acme.com" },
  { key: "location", label: "Location", category: "lead", example: "San Francisco, CA" },
  { key: "phone", label: "Phone", category: "lead", example: "+1-555-0123" },
  { key: "score", label: "Lead Score", category: "lead", example: "85" },
  { key: "icp_grade", label: "ICP Grade", category: "lead", example: "A" },
  // Contact fields
  { key: "contact.name", label: "Contact Name", category: "contact", example: "Jane Smith" },
  { key: "contact.title", label: "Contact Title", category: "contact", example: "VP of Sales" },
  { key: "contact.email", label: "Contact Email", category: "contact", example: "jane@acme.com" },
  // Sender fields
  { key: "sender.name", label: "Sender Name", category: "sender", example: "Alex" },
  { key: "sender.email", label: "Sender Email", category: "sender", example: "alex@company.com" },
  // System fields
  { key: "booking_link", label: "Booking Link", category: "system", example: "https://calendly.com/..." },
  { key: "unsubscribe_link", label: "Unsubscribe Link", category: "system" },
  { key: "today", label: "Today's Date", category: "system", example: "March 13, 2026" },
  { key: "day_of_week", label: "Day of Week", category: "system", example: "Friday" },
];

// ─── Context Builder ─────────────────────────────────────────────────────────

function splitName(fullName: string | null): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function getICPGrade(score: number | null): string {
  if (score == null) return "";
  if (score >= 90) return "A+";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

async function buildMergeContext(
  leadId: string,
  accountId?: string,
): Promise<MergeContext> {
  const admin = createAdminClient();
  const context: MergeContext = {};

  // Fetch lead
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (lead) {
    const { firstName, lastName } = splitName(lead.name);
    context.first_name = firstName;
    context.last_name = lastName;
    context.full_name = lead.name || "";
    context.name = lead.name || "";
    context.company = lead.company || "";
    context.email = lead.email || "";
    context.industry = lead.industry || "";
    context.website = lead.website || "";
    context.location = lead.location || "";
    context.phone = lead.phone || "";
    context.score = lead.score;
    context.icp_grade = getICPGrade(lead.icp_match_score);

    // Fetch primary contact
    const { data: contact } = await admin
      .from("contacts")
      .select("name, title, email")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (contact) {
      context["contact.name"] = contact.name || "";
      context["contact.title"] = contact.title || "";
      context["contact.email"] = contact.email || "";
    }

    // Fetch organization for booking URL
    const { data: org } = await admin
      .from("organizations")
      .select("booking_url")
      .eq("id", lead.organization_id)
      .single();

    if (org) {
      context.booking_link = org.booking_url || "";
    }

    // Fetch custom field values
    const { data: customValues } = await admin
      .from("lead_custom_field_values")
      .select("value, custom_fields(field_key)")
      .eq("lead_id", leadId);

    if (customValues) {
      for (const cv of customValues) {
        const fieldKey = (cv as Record<string, unknown>).custom_fields as { field_key: string } | null;
        if (fieldKey?.field_key && cv.value) {
          context[`cf.${fieldKey.field_key}`] = cv.value;
        }
      }
    }
  }

  // Sender (email account)
  if (accountId) {
    const { data: account } = await admin
      .from("email_accounts")
      .select("display_name, email_address")
      .eq("id", accountId)
      .single();

    if (account) {
      context["sender.name"] = account.display_name || "";
      context["sender.email"] = account.email_address || "";
    }
  }

  // System fields
  const now = new Date();
  context.today = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  context.day_of_week = now.toLocaleDateString("en-US", { weekday: "long" });

  // Unsubscribe link placeholder
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "https://pulse-crm-rosy.vercel.app";
  context.unsubscribe_link = `${appUrl}/unsubscribe?lead=${leadId}`;

  return context;
}

// ─── Conditional Content Parser ──────────────────────────────────────────────

function parseConditionals(template: string, context: MergeContext): string {
  // Pattern: {{#if condition}}content{{/if}}
  const ifPattern = /\{\{#if\s+(.+?)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  return template.replace(ifPattern, (_match, condition: string, content: string) => {
    const conditionResult = evaluateSimpleCondition(condition.trim(), context);
    return conditionResult ? content : "";
  });
}

function evaluateSimpleCondition(condition: string, context: MergeContext): boolean {
  // Negation: !field
  if (condition.startsWith("!")) {
    const field = condition.slice(1).trim();
    const val = context[field];
    return val == null || val === "" || val === 0;
  }

  // Comparison operators: field == "value", field >= number
  const compMatch = condition.match(/^(\S+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (compMatch) {
    const [, field, op, rawValue] = compMatch;
    const actual = context[field];
    // Remove quotes from string values
    const expected = rawValue.replace(/^["']|["']$/g, "");

    switch (op) {
      case "==": return String(actual) === expected;
      case "!=": return String(actual) !== expected;
      case ">=": return Number(actual) >= Number(expected);
      case "<=": return Number(actual) <= Number(expected);
      case ">": return Number(actual) > Number(expected);
      case "<": return Number(actual) < Number(expected);
    }
  }

  // Truthy check: just field name
  const val = context[condition];
  return val != null && val !== "" && val !== 0;
}

// ─── Variable Substitution ───────────────────────────────────────────────────

function substituteVariables(template: string, context: MergeContext): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key: string) => {
    const value = context[key];
    if (value == null || value === "") return "";
    return String(value);
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve all merge fields in a template string.
 * Handles conditionals first, then variable substitution.
 */
export async function resolveMergeFields(
  template: string,
  leadId: string,
  accountId?: string,
): Promise<string> {
  if (!template) return template;

  const context = await buildMergeContext(leadId, accountId);

  // Step 1: Process conditionals
  let result = parseConditionals(template, context);

  // Step 2: Substitute variables
  result = substituteVariables(result, context);

  return result;
}

/**
 * Extract all merge field keys used in a template.
 */
export function extractMergeFields(template: string): string[] {
  const fields = new Set<string>();

  // Standard variables
  const varPattern = /\{\{(\w+(?:\.\w+)*)\}\}/g;
  let match;
  while ((match = varPattern.exec(template)) !== null) {
    fields.add(match[1]);
  }

  // Variables inside conditionals
  const condPattern = /\{\{#if\s+(.+?)\}\}/g;
  while ((match = condPattern.exec(template)) !== null) {
    const condition = match[1].trim();
    // Extract field name from condition
    const fieldMatch = condition.match(/^!?(\w+(?:\.\w+)*)/);
    if (fieldMatch) fields.add(fieldMatch[1]);
  }

  return Array.from(fields);
}

/**
 * Get all available merge fields for an organization.
 */
export async function getAvailableMergeFields(orgId: string): Promise<MergeField[]> {
  const fields = [...BUILT_IN_MERGE_FIELDS];

  // Add custom fields
  const admin = createAdminClient();
  const { data: customFields } = await admin
    .from("custom_fields")
    .select("field_key, field_label")
    .eq("organization_id", orgId)
    .eq("is_merge_field", true);

  if (customFields) {
    for (const cf of customFields) {
      fields.push({
        key: `cf.${cf.field_key}`,
        label: cf.field_label,
        category: "custom",
      });
    }
  }

  return fields;
}

/**
 * Validate a template — check for unknown merge fields.
 */
export async function validateTemplate(
  template: string,
  orgId: string,
): Promise<{ valid: boolean; unknownFields: string[] }> {
  const usedFields = extractMergeFields(template);
  const available = await getAvailableMergeFields(orgId);
  const availableKeys = new Set(available.map((f) => f.key));

  const unknownFields = usedFields.filter((f) => !availableKeys.has(f));

  return {
    valid: unknownFields.length === 0,
    unknownFields,
  };
}
