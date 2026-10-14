// Data access the outreach logic needs, as an interface so the runners can be
// unit-tested with an in-memory fake. twenty-store.ts implements it against
// Twenty's GraphQL API.

import type { EnrollmentState } from 'src/gtm/sequences/enrollment-state';
import type { OpenerContext } from 'src/gtm/sequences/openers';
import type { PersonForTemplate } from 'src/gtm/sequences/render-template';
import type {
  InboxItemKind,
  OpenerStatus,
  SequenceStatus,
  StepType,
} from 'src/gtm/sequences/values';
import type { LeadStatus } from 'src/gtm/lead-values';

export type PersonRecord = PersonForTemplate & {
  id: string;
  leadStatus?: LeadStatus | null;
};

export type VariantRecord = {
  id: string;
  name?: string | null;
  subject: string | null;
  body: string | null;
  weight: number | null;
  isActive: boolean | null;
  isWinner?: boolean | null;
  sent: number | null;
  opened?: number | null;
  replied: number | null;
};

export type StepRecord = {
  id: string;
  order: number | null;
  delayDays: number | null;
  type: StepType | null;
  instructions?: string | null;
  template?: { id: string; subject: string | null; body: string | null } | null;
  variants?: VariantRecord[];
  autoPickWinner?: boolean | null;
  winnerMinSends?: number | null;
};

export type SequenceRecord = {
  id: string;
  name: string | null;
  status: SequenceStatus | null;
  businessDaysOnly: boolean | null;
  requireApprovedOpener?: boolean | null;
  steps: StepRecord[];
};

export type EnrollmentRecord = EnrollmentState & {
  id: string;
  personId: string;
  sequenceId: string;
  campaignId?: string | null;
  mailboxEmail?: string | null;
  lastError?: string | null;
  lastVariantId?: string | null;
  personalizedOpener?: string | null;
  customFirstLine?: string | null;
  customPs?: string | null;
  openerStatus?: OpenerStatus | null;
  customVariables?: Record<string, unknown> | null;
};

export type NewEnrollment = EnrollmentState & {
  name: string;
  personId: string;
  sequenceId: string;
  campaignId?: string | null;
};

export type EnrollmentPatch = Partial<
  Pick<
    EnrollmentRecord,
    | 'status'
    | 'currentStep'
    | 'nextSendAt'
    | 'lastSentAt'
    | 'repliedAt'
    | 'stopReason'
    | 'mailboxEmail'
    | 'lastError'
    | 'lastVariantId'
    | 'personalizedOpener'
    | 'customFirstLine'
    | 'customPs'
    | 'openerStatus'
  >
>;

export type VariantStatsDelta = Partial<Record<'sent' | 'opened' | 'replied', number>>;

export type CampaignStatsDelta = Partial<
  Record<'enrolled' | 'sent' | 'replied' | 'meetings', number>
>;

export type NewInboxItem = {
  subject: string;
  snippet: string | null;
  fromEmail: string | null;
  receivedAt: string;
  kind: InboxItemKind;
  mailboxEmail: string | null;
  messageId: string | null;
  personId: string;
  enrollmentId: string | null;
  sequenceId: string | null;
};

export type NewTask = { personId: string; title: string; body?: string | null; dueAt: string };

export interface SequenceStore {
  findDueEnrollments(now: Date, limit: number): Promise<EnrollmentRecord[]>;
  findEnrollments(filter: {
    personIds?: string[];
    sequenceId?: string;
    activeOnly?: boolean;
  }): Promise<EnrollmentRecord[]>;
  createEnrollment(data: NewEnrollment): Promise<string>;
  updateEnrollment(id: string, patch: EnrollmentPatch): Promise<void>;

  getSequence(id: string): Promise<SequenceRecord | null>;
  getPeople(ids: string[]): Promise<PersonRecord[]>;
  findPersonByEmail(email: string): Promise<PersonRecord | null>;
  setLeadStatus(personId: string, status: LeadStatus): Promise<void>;

  incrementCampaignStats(campaignId: string, delta: CampaignStatsDelta): Promise<void>;

  hasInboxItemForMessage(messageId: string): Promise<boolean>;
  createInboxItem(data: NewInboxItem): Promise<string>;

  createTask(data: NewTask): Promise<string>;

  getEnrollmentsByIds(ids: string[]): Promise<EnrollmentRecord[]>;
  incrementVariantStats(variantId: string, delta: VariantStatsDelta): Promise<void>;
  // Flags this variant as the step's winner (and clears the flag on siblings).
  setVariantWinner(stepId: string, variantId: string): Promise<void>;
  variantExists(variantId: string): Promise<boolean>;

  // Facts for opener generation, keyed by person id.
  getOpenerContexts(personIds: string[]): Promise<Map<string, OpenerContext>>;
}

const PATCH_KEYS = [
  'status',
  'currentStep',
  'nextSendAt',
  'lastSentAt',
  'repliedAt',
  'stopReason',
  'mailboxEmail',
  'lastError',
  'lastVariantId',
  'personalizedOpener',
  'customFirstLine',
  'customPs',
  'openerStatus',
] as const;

// Keeps only writable enrollment fields, so a whole state object can be passed
// as a patch.
export const pickEnrollmentPatch = (patch: EnrollmentPatch): EnrollmentPatch => {
  const out: Record<string, unknown> = {};
  for (const key of PATCH_KEYS) if (patch[key] !== undefined) out[key] = patch[key];
  return out as EnrollmentPatch;
};

export const sortSteps =(steps: StepRecord[]): StepRecord[] =>
  [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export const personLabel = (p: PersonForTemplate | null | undefined): string =>
  [p?.name?.firstName, p?.name?.lastName].filter(Boolean).join(' ') ||
  p?.emails?.primaryEmail ||
  'Unknown person';
