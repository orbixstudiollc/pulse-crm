// Columns a user may change on their own profile row. Anything not listed
// here (identity, tenancy, permission and timestamp columns, unknown keys)
// is dropped before the update reaches the database.
export const PROFILE_UPDATABLE_FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "job_title",
  "timezone",
  "date_format",
  "time_format",
  "language",
  "notification_preferences",
] as const;

export type ProfileUpdatableField = (typeof PROFILE_UPDATABLE_FIELDS)[number];

// Returns a new object holding only the caller's own allowlisted keys whose
// value is not undefined. The input is never mutated.
export function pickProfileUpdates(
  updates: Record<string, unknown>,
): Partial<Record<ProfileUpdatableField, unknown>> {
  const safe: Partial<Record<ProfileUpdatableField, unknown>> = {};
  for (const field of PROFILE_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field) && updates[field] !== undefined) {
      safe[field] = updates[field];
    }
  }
  return safe;
}
