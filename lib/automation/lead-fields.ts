/**
 * Lead columns an automation `update_field` action may write.
 * Never identity, tenancy, ownership or contact columns
 * (id, organization_id, assigned_to, email, created_by).
 */
export const UPDATE_FIELD_ALLOWLIST = [
  "status",
  "score",
  "industry",
  "source",
  "tags",
  "company",
  "title",
] as const;

export type UpdatableLeadField = (typeof UPDATE_FIELD_ALLOWLIST)[number];

export function isAllowedLeadField(field: unknown): field is UpdatableLeadField {
  return (
    typeof field === "string" &&
    (UPDATE_FIELD_ALLOWLIST as readonly string[]).includes(field)
  );
}
