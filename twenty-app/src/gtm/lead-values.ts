// Select values shared by the field definitions and the Pulse import.

export const LEAD_STATUSES = [
  { label: 'New', value: 'NEW', color: 'gray' },
  { label: 'Hot', value: 'HOT', color: 'red' },
  { label: 'Warm', value: 'WARM', color: 'orange' },
  { label: 'Cold', value: 'COLD', color: 'sky' },
  { label: 'Qualified', value: 'QUALIFIED', color: 'green' },
  { label: 'Customer', value: 'CUSTOMER', color: 'purple' },
  { label: 'Disqualified', value: 'DISQUALIFIED', color: 'gray' },
] as const;

export const LEAD_SOURCES = [
  { label: 'Website', value: 'WEBSITE', color: 'blue' },
  { label: 'Referral', value: 'REFERRAL', color: 'green' },
  { label: 'LinkedIn', value: 'LINKEDIN', color: 'sky' },
  { label: 'Event', value: 'EVENT', color: 'purple' },
  { label: 'Google Ads', value: 'GOOGLE_ADS', color: 'yellow' },
  { label: 'Cold call', value: 'COLD_CALL', color: 'orange' },
  { label: 'Cold outreach', value: 'COLD_OUTREACH', color: 'amber' },
  { label: 'Prospeo', value: 'PROSPEO', color: 'iris' },
  { label: 'Import', value: 'IMPORT', color: 'gray' },
  { label: 'Other', value: 'OTHER', color: 'gray' },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]['value'];
export type LeadSource = (typeof LEAD_SOURCES)[number]['value'];
