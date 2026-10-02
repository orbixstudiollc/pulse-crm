// Select values for the outreach objects (templates, sequences, enrollments,
// campaigns, inbox). Shared by the object definitions and the logic functions.

export const TEMPLATE_CATEGORIES = [
  { label: 'Cold outreach', value: 'COLD_OUTREACH', color: 'blue' },
  { label: 'Follow-up', value: 'FOLLOW_UP', color: 'sky' },
  { label: 'Breakup', value: 'BREAKUP', color: 'gray' },
  { label: 'Meeting', value: 'MEETING', color: 'green' },
  { label: 'Nurture', value: 'NURTURE', color: 'purple' },
  { label: 'General', value: 'GENERAL', color: 'gray' },
] as const;

export const SEQUENCE_STATUSES = [
  { label: 'Draft', value: 'DRAFT', color: 'gray' },
  { label: 'Active', value: 'ACTIVE', color: 'green' },
  { label: 'Paused', value: 'PAUSED', color: 'orange' },
] as const;

export const STEP_TYPES = [
  { label: 'Email', value: 'EMAIL', color: 'blue' },
  { label: 'Task', value: 'TASK', color: 'purple' },
] as const;

export const ENROLLMENT_STATUSES = [
  { label: 'Active', value: 'ACTIVE', color: 'green' },
  { label: 'Replied', value: 'REPLIED', color: 'red' },
  { label: 'Bounced', value: 'BOUNCED', color: 'orange' },
  { label: 'Finished', value: 'FINISHED', color: 'gray' },
  { label: 'Stopped', value: 'STOPPED', color: 'gray' },
] as const;

export const CAMPAIGN_STATUSES = [
  { label: 'Draft', value: 'DRAFT', color: 'gray' },
  { label: 'Active', value: 'ACTIVE', color: 'green' },
  { label: 'Paused', value: 'PAUSED', color: 'orange' },
  { label: 'Completed', value: 'COMPLETED', color: 'blue' },
] as const;

export const INBOX_ITEM_KINDS = [
  { label: 'Reply', value: 'REPLY', color: 'green' },
  { label: 'Bounce', value: 'BOUNCE', color: 'orange' },
  { label: 'Email', value: 'EMAIL', color: 'blue' },
] as const;

export const INBOX_ITEM_STATUSES = [
  { label: 'Unread', value: 'UNREAD', color: 'red' },
  { label: 'Read', value: 'READ', color: 'gray' },
  { label: 'Archived', value: 'ARCHIVED', color: 'gray' },
] as const;

export const OPENER_STATUSES = [
  { label: 'Draft', value: 'DRAFT', color: 'yellow' },
  { label: 'Approved', value: 'APPROVED', color: 'green' },
] as const;

export type OpenerStatus = (typeof OPENER_STATUSES)[number]['value'];
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]['value'];
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number]['value'];
export type StepType = (typeof STEP_TYPES)[number]['value'];
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]['value'];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]['value'];
export type InboxItemKind = (typeof INBOX_ITEM_KINDS)[number]['value'];
export type InboxItemStatus = (typeof INBOX_ITEM_STATUSES)[number]['value'];

// Turns a values list into select options with positions.
export const toOptions = <T extends { label: string; value: string; color: string }>(
  values: readonly T[],
) => values.map((v, position) => ({ ...v, position }));
