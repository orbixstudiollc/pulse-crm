import { rescorePerson } from 'src/gtm/leadfinder/rescore';

// Shared handler for the person.created / person.updated triggers.
//
// Loop guard, in three layers:
// 1. the update trigger only listens to the fields that feed the score
//    (RESCORE_INPUT_FIELDS), so writing leadScore/icpGrade does not re-fire it;
// 2. shouldRescore() ignores updates that only touch score output fields;
// 3. rescorePerson() writes only when the score or grade actually changes.

export const RESCORE_INPUT_FIELDS = ['jobTitle', 'location', 'companyId'];
const SCORE_OUTPUT_FIELDS = new Set(['leadScore', 'icpGrade', 'updatedAt', 'updatedBy', 'position', 'searchVector']);

type EventLike = {
  recordId?: string;
  properties?: { updatedFields?: string[] };
};

export function shouldRescore(event: EventLike): boolean {
  if (!event.recordId) return false;
  const updated = event.properties?.updatedFields;
  if (!updated) return true; // created
  return updated.some((f) => !SCORE_OUTPUT_FIELDS.has(f));
}

export async function handleRescoreEvent(payload: unknown) {
  const event = (payload ?? {}) as EventLike;
  if (!shouldRescore(event)) return { skipped: true };
  try {
    const { result, updated } = await rescorePerson(event.recordId!);
    return { skipped: false, score: result?.score ?? null, grade: result?.grade ?? null, updated };
  } catch (err) {
    // Never fail record writes because scoring failed.
    return { skipped: false, error: err instanceof Error ? err.message : String(err) };
  }
}
