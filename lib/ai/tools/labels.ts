// Past-tense step labels for the Copilot step trace, keyed by tool name.
export const TOOL_LABELS: Record<string, string> = {
  // Reads
  get_workspace_summary: "Checked workspace summary",
  search_leads: "Searched leads",
  get_lead: "Opened lead",
  list_followups: "Listed follow-ups",
  search_deals: "Searched deals",
  get_deal: "Opened deal",
  search_customers: "Searched customers",
  get_customer: "Opened customer",
  search_contacts: "Searched contacts",
  list_activities: "Listed activities",
  list_calendar_events: "Listed calendar events",
  list_campaigns: "Listed campaigns",
  get_leads_overview: "Reviewed lead overview",
  // Record writes
  create_lead: "Created lead",
  update_lead: "Updated lead",
  set_followup: "Set follow-up",
  convert_lead_to_customer: "Converted lead to customer",
  create_deal: "Created deal",
  update_deal: "Updated deal",
  create_customer: "Created customer",
  update_customer: "Updated customer",
  create_contact: "Created contact",
  update_contact: "Updated contact",
  create_activity: "Logged activity",
  update_activity: "Updated activity",
  create_calendar_event: "Added calendar event",
  add_note: "Added note",
  // Copilot-only
  save_artifact: "Saved artifact",
  save_memory: "Saved memory",
  draft_email: "Drafted email",
  create_task: "Created task",
  // UI-only: never shown in the step trace (ChatMessageParts renders it as option buttons).
  suggest_next: "Suggested next steps",
};

/** Labels for a step trace row that stands for `n` (> 1) finished calls of one tool. */
const PLURAL_LABELS: Record<string, (n: number) => string> = {
  search_leads: (n) => `Searched leads (${n})`,
  search_deals: (n) => `Searched deals (${n})`,
  search_customers: (n) => `Searched customers (${n})`,
  search_contacts: (n) => `Searched contacts (${n})`,
  get_lead: (n) => `Opened ${n} leads`,
  get_deal: (n) => `Opened ${n} deals`,
  get_customer: (n) => `Opened ${n} customers`,
  list_activities: (n) => `Listed activities (${n})`,
  // list_activities filtered to one record of a type (ChatMessageParts picks the variant).
  "list_activities:lead": (n) => `Listed activities for ${n} leads`,
  "list_activities:deal": (n) => `Listed activities for ${n} deals`,
  "list_activities:customer": (n) => `Listed activities for ${n} customers`,
  // Counts leads reviewed, not calls: one call covers several leads.
  get_leads_overview: (n) => `Reviewed ${n} leads`,
};

/**
 * The step trace label for `count` finished calls of a tool. `name` may carry a ":variant"
 * suffix (e.g. "list_activities:lead"); without a plural form the label reads "<label> ×N".
 */
export function toolLabel(name: string, count = 1): string {
  const base = name.split(":")[0];
  const label = TOOL_LABELS[name] ?? TOOL_LABELS[base] ?? base;
  if (count <= 1) return label;
  const plural = PLURAL_LABELS[name] ?? PLURAL_LABELS[base];
  return plural ? plural(count) : `${label} ×${count}`;
}
