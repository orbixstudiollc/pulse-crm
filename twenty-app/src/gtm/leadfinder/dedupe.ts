import type { ProspeoPersonFields } from 'src/gtm/prospeo/people';

// Pure dedupe for findLeads: drop results already in Twenty (by Prospeo id or
// email), duplicates within the batch, and results with no usable name.

export type DedupePlan = {
  toCreate: ProspeoPersonFields[];
  duplicates: number;
  unusable: number;
};

export function planNewLeads(
  results: ProspeoPersonFields[],
  existing: { prospeoIds: Iterable<string>; emails: Iterable<string> },
): DedupePlan {
  const seenIds = new Set(existing.prospeoIds);
  const seenEmails = new Set([...existing.emails].map((e) => e.toLowerCase()));
  const toCreate: ProspeoPersonFields[] = [];
  let duplicates = 0;
  let unusable = 0;
  for (const r of results) {
    if (!r.personId || !(r.fullName || r.firstName || r.lastName)) {
      unusable++;
      continue;
    }
    const email = r.email?.toLowerCase();
    if (seenIds.has(r.personId) || (email && seenEmails.has(email))) {
      duplicates++;
      continue;
    }
    seenIds.add(r.personId);
    if (email) seenEmails.add(email);
    toCreate.push(r);
  }
  return { toCreate, duplicates, unusable };
}

/** Explicit filters win over the ICP's, field by field. */
export function mergeSearchInput<T extends Record<string, unknown>>(fromIcp: T, explicit: T): T {
  const out: Record<string, unknown> = { ...fromIcp };
  for (const [key, value] of Object.entries(explicit)) {
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (!empty) out[key] = value;
  }
  return out as T;
}
