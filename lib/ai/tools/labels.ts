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
