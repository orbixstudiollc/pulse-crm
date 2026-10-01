// Enrolls people in a sequence. Used by the enrollInSequence tool.

import { initialEnrollmentState } from 'src/gtm/sequences/enrollment-state';
import { personLabel, sortSteps, type SequenceStore } from 'src/gtm/sequences/store';

export type EnrollInput = {
  personIds: string[];
  sequenceId: string;
  campaignId?: string | null;
};

export type EnrollResult = {
  sequenceId: string;
  enrolled: { personId: string; enrollmentId: string; nextSendAt: string | null }[];
  skipped: { personId: string; reason: string }[];
};

export const MAX_ENROLL_BATCH = 500;

export const enrollPeople = async ({
  store,
  input,
  now = new Date(),
}: {
  store: SequenceStore;
  input: EnrollInput;
  now?: Date;
}): Promise<EnrollResult> => {
  const personIds = [...new Set((input.personIds ?? []).filter(Boolean))];
  if (!input.sequenceId) throw new Error('sequenceId is required');
  if (personIds.length === 0) throw new Error('personIds must list at least one person');
  if (personIds.length > MAX_ENROLL_BATCH) {
    throw new Error(`Enroll at most ${MAX_ENROLL_BATCH} people per call`);
  }

  const sequence = await store.getSequence(input.sequenceId);
  if (!sequence) throw new Error(`Sequence ${input.sequenceId} not found`);
  const steps = sortSteps(sequence.steps);
  if (steps.length === 0) throw new Error(`Sequence "${sequence.name ?? sequence.id}" has no steps`);

  const result: EnrollResult = { sequenceId: sequence.id, enrolled: [], skipped: [] };

  // One enrollment per person per sequence, as in Pulse.
  const existing = new Set(
    (await store.findEnrollments({ personIds, sequenceId: sequence.id })).map((e) => e.personId),
  );
  const people = new Map((await store.getPeople(personIds)).map((p) => [p.id, p]));
  const needsEmail = steps.some((s) => s.type !== 'TASK');

  for (const personId of personIds) {
    const person = people.get(personId);
    if (!person) {
      result.skipped.push({ personId, reason: 'Person not found' });
      continue;
    }
    if (existing.has(personId)) {
      result.skipped.push({ personId, reason: 'Already enrolled in this sequence' });
      continue;
    }
    if (needsEmail && !person.emails?.primaryEmail?.trim()) {
      result.skipped.push({ personId, reason: 'No email address' });
      continue;
    }
    if (person.leadStatus === 'DISQUALIFIED' || person.leadStatus === 'CUSTOMER') {
      result.skipped.push({ personId, reason: `Lead status is ${person.leadStatus}` });
      continue;
    }

    const state = initialEnrollmentState(steps, now, {
      businessDaysOnly: Boolean(sequence.businessDaysOnly),
    });
    const enrollmentId = await store.createEnrollment({
      ...state,
      name: `${personLabel(person)} · ${sequence.name ?? 'Sequence'}`,
      personId,
      sequenceId: sequence.id,
      campaignId: input.campaignId ?? null,
    });
    result.enrolled.push({ personId, enrollmentId, nextSendAt: state.nextSendAt });
  }

  if (input.campaignId && result.enrolled.length > 0) {
    await store.incrementCampaignStats(input.campaignId, { enrolled: result.enrolled.length });
  }
  return result;
};
