// Put Qualified leads into a sequence (and campaign). Checks the gates that
// can change after qualification (email, suppression) once more, then marks
// the enrolled people Enrolled so they are not picked twice.

import { enrollPeople, MAX_ENROLL_BATCH } from 'src/gtm/sequences/enroll';
import type { SequenceStore } from 'src/gtm/sequences/store';
import { suppressionReason } from 'src/gtm/qualify/gate';
import type { QualifyStore } from 'src/gtm/qualify/store';

export type EnrollQualifiedInput = { sequenceId?: string; campaignId?: string | null; limit?: number; dryRun?: boolean };

export type EnrollQualifiedResult = {
  ok: true;
  dryRun: boolean;
  eligible: number;
  enrolled: number;
  skipped: { personId: string; reason: string }[];
};

export const enrollQualified = async ({
  store,
  sequences,
  input,
  now = new Date(),
}: {
  store: QualifyStore;
  sequences: SequenceStore;
  input: EnrollQualifiedInput;
  now?: Date;
}): Promise<EnrollQualifiedResult> => {
  if (!input.sequenceId) throw new Error('sequenceId is required');
  const limit = Math.min(Math.max(Number(input.limit) || MAX_ENROLL_BATCH, 1), MAX_ENROLL_BATCH);
  const people = await store.qualifiedPeople(limit);
  const [blocked, ownDomains] = await Promise.all([store.blockedHandles(), store.ownDomains()]);

  const skipped: { personId: string; reason: string }[] = [];
  const eligible: string[] = [];
  for (const p of people) {
    if (p.emailStatus !== 'VERIFIED') {
      skipped.push({ personId: p.id, reason: 'Email not verified' });
      continue;
    }
    const why = suppressionReason({ email: p.email, leadStatus: p.leadStatus, emailStatus: p.emailStatus, blockedHandles: blocked, ownDomains });
    if (why) {
      skipped.push({ personId: p.id, reason: `Suppressed: ${why}` });
      continue;
    }
    eligible.push(p.id);
  }

  if (input.dryRun || eligible.length === 0) {
    return { ok: true, dryRun: Boolean(input.dryRun), eligible: eligible.length, enrolled: 0, skipped };
  }

  const res = await enrollPeople({ store: sequences, input: { personIds: eligible, sequenceId: input.sequenceId, campaignId: input.campaignId ?? null }, now });
  const done = new Set(res.enrolled.map((e) => e.personId));
  for (const s of res.skipped) {
    if (s.reason === 'Already enrolled in this sequence') done.add(s.personId);
    else skipped.push(s);
  }
  for (const id of done) await store.updatePerson(id, { qualificationStatus: 'ENROLLED' });
  return { ok: true, dryRun: false, eligible: eligible.length, enrolled: res.enrolled.length, skipped };
};
