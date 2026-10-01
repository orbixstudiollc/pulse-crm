// Enrollment state machine. Pure: no I/O.
//
//   ACTIVE --step done, more steps--> ACTIVE (currentStep + 1, nextSendAt moved)
//   ACTIVE --last step done-------->  FINISHED
//   ACTIVE --reply----------------->  REPLIED   (stops the sequence)
//   ACTIVE --bounce---------------->  BOUNCED   (stops the sequence)
//   ACTIVE --stop------------------>  STOPPED
//
// REPLIED, BOUNCED, FINISHED and STOPPED are terminal. A reply or bounce on an
// enrollment that already ended is recorded as a no-op, except that a reply
// after FINISHED still counts as a reply (people often answer the last email).

import { addDelay, type ScheduleOptions } from 'src/gtm/sequences/scheduler';
import type { EnrollmentStatus } from 'src/gtm/sequences/values';

export type EnrollmentState = {
  status: EnrollmentStatus;
  // 1-based position of the next step to run, in step order.
  currentStep: number;
  nextSendAt: string | null;
  lastSentAt?: string | null;
  repliedAt?: string | null;
  stopReason?: string | null;
};

export type StepTiming = { delayDays: number | null | undefined };

export type EnrollmentEvent =
  | { type: 'STEP_COMPLETED'; at: Date; steps: StepTiming[]; schedule?: ScheduleOptions }
  | { type: 'REPLY_RECEIVED'; at: Date }
  | { type: 'BOUNCED'; at: Date }
  | { type: 'STOP'; at: Date; reason?: string };

export const TERMINAL_STATUSES: readonly EnrollmentStatus[] = [
  'REPLIED',
  'BOUNCED',
  'FINISHED',
  'STOPPED',
];

export const isTerminal = (status: EnrollmentStatus) => TERMINAL_STATUSES.includes(status);

// The schedule for a brand-new enrollment: step 1, due after its delay.
export const initialEnrollmentState = (
  steps: StepTiming[],
  now: Date,
  schedule: ScheduleOptions = {},
): EnrollmentState => {
  if (steps.length === 0) {
    return { status: 'FINISHED', currentStep: 1, nextSendAt: null, stopReason: 'Sequence has no steps' };
  }
  return {
    status: 'ACTIVE',
    currentStep: 1,
    nextSendAt: addDelay(now, steps[0].delayDays, schedule).toISOString(),
  };
};

export const transition = (state: EnrollmentState, event: EnrollmentEvent): EnrollmentState => {
  const at = event.at.toISOString();
  switch (event.type) {
    case 'STEP_COMPLETED': {
      if (state.status !== 'ACTIVE') return state;
      const next = state.currentStep + 1;
      if (next > event.steps.length) {
        return { ...state, status: 'FINISHED', currentStep: next, nextSendAt: null, lastSentAt: at };
      }
      return {
        ...state,
        currentStep: next,
        lastSentAt: at,
        nextSendAt: addDelay(event.at, event.steps[next - 1].delayDays, event.schedule).toISOString(),
      };
    }
    case 'REPLY_RECEIVED':
      if (state.status !== 'ACTIVE' && state.status !== 'FINISHED') return state;
      return { ...state, status: 'REPLIED', nextSendAt: null, repliedAt: at };
    case 'BOUNCED':
      if (state.status !== 'ACTIVE') return state;
      return { ...state, status: 'BOUNCED', nextSendAt: null, stopReason: 'Email bounced' };
    case 'STOP':
      if (isTerminal(state.status)) return state;
      return { ...state, status: 'STOPPED', nextSendAt: null, stopReason: event.reason ?? 'Stopped' };
    default:
      return state;
  }
};
