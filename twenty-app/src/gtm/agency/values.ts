// Select values for the agency objects (services, proposals, projects,
// invoices, client emails). Shared by the object definitions and the logic.

export const SERVICE_CATEGORIES = [
  { label: 'Branding', value: 'BRANDING', color: 'purple' },
  { label: 'UI/UX', value: 'UI_UX', color: 'pink' },
  { label: 'Development', value: 'DEVELOPMENT', color: 'blue' },
  { label: 'Growth', value: 'GROWTH', color: 'green' },
  { label: 'Other', value: 'OTHER', color: 'gray' },
] as const;

export const PROPOSAL_STATUSES = [
  { label: 'Draft', value: 'DRAFT', color: 'gray' },
  { label: 'Sent', value: 'SENT', color: 'blue' },
  { label: 'Viewed', value: 'VIEWED', color: 'sky' },
  { label: 'Accepted', value: 'ACCEPTED', color: 'green' },
  { label: 'Changes requested', value: 'CHANGES_REQUESTED', color: 'orange' },
  { label: 'Declined', value: 'DECLINED', color: 'red' },
] as const;

export const PROJECT_STATUSES = [
  { label: 'Kickoff', value: 'KICKOFF', color: 'sky' },
  { label: 'In progress', value: 'IN_PROGRESS', color: 'blue' },
  { label: 'In review', value: 'IN_REVIEW', color: 'purple' },
  { label: 'Delivered', value: 'DELIVERED', color: 'green' },
  { label: 'On hold', value: 'ON_HOLD', color: 'gray' },
] as const;

export const PROJECT_HEALTHS = [
  { label: 'On track', value: 'ON_TRACK', color: 'green' },
  { label: 'At risk', value: 'AT_RISK', color: 'red' },
  { label: 'Quiet client', value: 'QUIET', color: 'orange' },
] as const;

export const INVOICE_STATUSES = [
  { label: 'Draft', value: 'DRAFT', color: 'gray' },
  { label: 'Approved', value: 'APPROVED', color: 'yellow' },
  { label: 'Sent', value: 'SENT', color: 'blue' },
  { label: 'Paid', value: 'PAID', color: 'green' },
  { label: 'Overdue', value: 'OVERDUE', color: 'red' },
  { label: 'Void', value: 'VOID', color: 'gray' },
] as const;

export const CLIENT_EMAIL_KINDS = [
  { label: 'Proposal', value: 'PROPOSAL', color: 'blue' },
  { label: 'Proposal follow-up', value: 'PROPOSAL_FOLLOW_UP', color: 'sky' },
  { label: 'Welcome', value: 'WELCOME', color: 'green' },
  { label: 'Weekly update', value: 'WEEKLY_UPDATE', color: 'purple' },
  { label: 'Invoice reminder', value: 'INVOICE_REMINDER', color: 'orange' },
  { label: 'Upsell', value: 'UPSELL', color: 'turquoise' },
  { label: 'Renewal', value: 'RENEWAL', color: 'turquoise' },
  { label: 'Referral ask', value: 'REFERRAL', color: 'pink' },
] as const;

export const CLIENT_EMAIL_STATUSES = [
  { label: 'Draft', value: 'DRAFT', color: 'yellow' },
  { label: 'Approved', value: 'APPROVED', color: 'blue' },
  { label: 'Sent', value: 'SENT', color: 'green' },
  { label: 'Failed', value: 'FAILED', color: 'red' },
  { label: 'Skipped', value: 'SKIPPED', color: 'gray' },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]['value'];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]['value'];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]['value'];
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number]['value'];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]['value'];
export type ClientEmailKind = (typeof CLIENT_EMAIL_KINDS)[number]['value'];
export type ClientEmailStatus = (typeof CLIENT_EMAIL_STATUSES)[number]['value'];

// Projects still being worked on (weekly updates go to these).
export const ACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = ['KICKOFF', 'IN_PROGRESS', 'IN_REVIEW'];
