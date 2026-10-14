import { describe, expect, it } from 'vitest';

import {
  initialEnrollmentState,
  isTerminal,
  transition,
  type EnrollmentState,
} from 'src/gtm/sequences/enrollment-state';

const now = new Date('2026-10-01T09:00:00Z');
const later = new Date('2026-10-02T09:00:00Z');
const steps = [{ delayDays: 0 }, { delayDays: 3 }, { delayDays: 4 }];

const active = (currentStep = 1): EnrollmentState => ({
  status: 'ACTIVE',
  currentStep,
  nextSendAt: now.toISOString(),
});

describe('initialEnrollmentState', () => {
  it('schedules step 1 after its delay', () => {
    expect(initialEnrollmentState(steps, now)).toEqual({
      status: 'ACTIVE',
      currentStep: 1,
      nextSendAt: now.toISOString(),
    });
    expect(initialEnrollmentState([{ delayDays: 2 }], now).nextSendAt).toBe('2026-10-03T09:00:00.000Z');
  });

  it('finishes immediately when there are no steps', () => {
    expect(initialEnrollmentState([], now).status).toBe('FINISHED');
  });
});

describe('transition', () => {
  it('moves to the next step and schedules it from the send time', () => {
    const s = transition(active(1), { type: 'STEP_COMPLETED', at: now, steps });
    expect(s).toMatchObject({ status: 'ACTIVE', currentStep: 2, lastSentAt: now.toISOString() });
    expect(s.nextSendAt).toBe('2026-10-04T09:00:00.000Z');
  });

  it('uses business days when the schedule asks', () => {
    const s = transition(active(1), {
      type: 'STEP_COMPLETED',
      at: now,
      steps,
      schedule: { businessDaysOnly: true },
    });
    expect(s.nextSendAt).toBe('2026-10-06T09:00:00.000Z');
  });

  it('finishes after the last step', () => {
    const s = transition(active(3), { type: 'STEP_COMPLETED', at: now, steps });
    expect(s).toMatchObject({ status: 'FINISHED', nextSendAt: null });
  });

  it('stops on reply and on bounce', () => {
    expect(transition(active(2), { type: 'REPLY_RECEIVED', at: later })).toMatchObject({
      status: 'REPLIED',
      nextSendAt: null,
      repliedAt: later.toISOString(),
    });
    expect(transition(active(2), { type: 'BOUNCED', at: later })).toMatchObject({
      status: 'BOUNCED',
      nextSendAt: null,
    });
  });

  it('counts a reply after the sequence finished', () => {
    const finished: EnrollmentState = { status: 'FINISHED', currentStep: 4, nextSendAt: null };
    expect(transition(finished, { type: 'REPLY_RECEIVED', at: later }).status).toBe('REPLIED');
    expect(transition(finished, { type: 'BOUNCED', at: later }).status).toBe('FINISHED');
  });

  it('ignores events on terminal states', () => {
    for (const status of ['REPLIED', 'BOUNCED', 'STOPPED'] as const) {
      const s: EnrollmentState = { status, currentStep: 2, nextSendAt: null };
      expect(transition(s, { type: 'STEP_COMPLETED', at: now, steps })).toBe(s);
      expect(transition(s, { type: 'REPLY_RECEIVED', at: now })).toBe(s);
      expect(transition(s, { type: 'STOP', at: now })).toBe(s);
      expect(isTerminal(status)).toBe(true);
    }
    expect(isTerminal('ACTIVE')).toBe(false);
  });

  it('stops manually with a reason', () => {
    expect(transition(active(), { type: 'STOP', at: now, reason: 'No email address' })).toMatchObject({
      status: 'STOPPED',
      stopReason: 'No email address',
      nextSendAt: null,
    });
  });
});
