// Select values for the mailbox object, shared by the field definitions and the engine.

export const MAILBOX_PROVIDERS = [
  { label: 'Google', value: 'GOOGLE', color: 'red' },
  { label: 'Microsoft', value: 'MICROSOFT', color: 'blue' },
  { label: 'Other', value: 'OTHER', color: 'gray' },
] as const;

export const MAILBOX_STATUSES = [
  { label: 'Warming', value: 'WARMING', color: 'orange' },
  { label: 'Active', value: 'ACTIVE', color: 'green' },
  { label: 'Paused', value: 'PAUSED', color: 'gray' },
  { label: 'Error', value: 'ERROR', color: 'red' },
] as const;

// Warmup stages, in order. Each stage unlocks a higher daily cap for sequence sends.
export const WARMUP_STAGES = [
  { label: 'Starting', value: 'STARTING', color: 'sky' },
  { label: 'Building', value: 'BUILDING', color: 'blue' },
  { label: 'Ramping', value: 'RAMPING', color: 'turquoise' },
  { label: 'Mature', value: 'MATURE', color: 'green' },
] as const;

export type MailboxProvider = (typeof MAILBOX_PROVIDERS)[number]['value'];
export type MailboxStatus = (typeof MAILBOX_STATUSES)[number]['value'];
export type WarmupStage = (typeof WARMUP_STAGES)[number]['value'];
