// Drafts personalised openers for enrollments. Used by the generateOpeners
// tool. Openers land as DRAFT; a person approves them (openerStatus APPROVED)
// in the Openers view, and sequences with "require approved opener" wait.

import {
  buildOpenerPrompt,
  parseOpenerResponse,
  type OpenerWriter,
} from 'src/gtm/sequences/openers';
import type { EnrollmentRecord, SequenceStore } from 'src/gtm/sequences/store';

export type GenerateOpenersInput = {
  personIds?: string[];
  enrollmentIds?: string[];
  style?: string | null;
  // Regenerate openers that were already approved. Off by default.
  overwriteApproved?: boolean;
};

export type GenerateOpenersResult = {
  drafted: { enrollmentId: string; personId: string; opener: string }[];
  skipped: { id: string; reason: string }[];
};

export const MAX_OPENERS_PER_CALL = 25;

export const generateOpeners = async ({
  store,
  writer,
  input,
}: {
  store: SequenceStore;
  writer: OpenerWriter;
  input: GenerateOpenersInput;
}): Promise<GenerateOpenersResult> => {
  const result: GenerateOpenersResult = { drafted: [], skipped: [] };
  const enrollmentIds = [...new Set(input.enrollmentIds ?? [])].filter(Boolean);
  const personIds = [...new Set(input.personIds ?? [])].filter(Boolean);
  if (enrollmentIds.length === 0 && personIds.length === 0) {
    throw new Error('Give personIds or enrollmentIds');
  }

  const targets = new Map<string, EnrollmentRecord>();
  if (enrollmentIds.length) {
    const found = await store.getEnrollmentsByIds(enrollmentIds);
    for (const e of found) targets.set(e.id, e);
    for (const id of enrollmentIds) {
      if (!targets.has(id)) result.skipped.push({ id, reason: 'Enrollment not found' });
    }
  }
  if (personIds.length) {
    const active = await store.findEnrollments({ personIds, activeOnly: true });
    for (const e of active) targets.set(e.id, e);
    const covered = new Set(active.map((e) => e.personId));
    for (const id of personIds) {
      if (!covered.has(id)) result.skipped.push({ id, reason: 'Not in an active sequence' });
    }
  }

  const queue: EnrollmentRecord[] = [];
  for (const e of targets.values()) {
    if (e.openerStatus === 'APPROVED' && !input.overwriteApproved) {
      result.skipped.push({ id: e.id, reason: 'Opener already approved' });
    } else if (queue.length >= MAX_OPENERS_PER_CALL) {
      result.skipped.push({ id: e.id, reason: `Limit of ${MAX_OPENERS_PER_CALL} per call; run again` });
    } else {
      queue.push(e);
    }
  }
  if (queue.length === 0) return result;

  const contexts = await store.getOpenerContexts([...new Set(queue.map((e) => e.personId))]);
  for (const enrollment of queue) {
    const context = contexts.get(enrollment.personId);
    if (!context) {
      result.skipped.push({ id: enrollment.id, reason: 'Person not found' });
      continue;
    }
    try {
      const draft = parseOpenerResponse(await writer.write(buildOpenerPrompt(context, input.style)));
      if (!draft) {
        result.skipped.push({ id: enrollment.id, reason: 'The AI returned no usable opener' });
        continue;
      }
      await store.updateEnrollment(enrollment.id, {
        personalizedOpener: draft.opener,
        customFirstLine: draft.firstLine,
        customPs: draft.ps,
        openerStatus: 'DRAFT',
      });
      result.drafted.push({ enrollmentId: enrollment.id, personId: enrollment.personId, opener: draft.opener });
    } catch (error) {
      result.skipped.push({
        id: enrollment.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
};
