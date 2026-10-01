// Pure field-diff + staleness check for AI write-tool confirmation cards.
// No supabase imports: callers pass the DB column patch (toPatch(input)) and the current row.

export type FieldDiff = {
  kind: "create" | "update";
  recordType: string;
  recordId?: string;
  /** The record's updated_at when the diff was computed (write precondition). */
  baselineUpdatedAt?: string;
  fields: Array<{ name: string; before?: unknown; after: unknown }>;
};

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;

function normalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return DATE_LIKE.test(value) ? value.slice(0, 10) : value;
  }
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = normalise((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
}

export function computeFieldDiff(args: {
  toolName: string;
  input: Record<string, unknown>;
  current: Record<string, unknown> | null;
  recordType: string;
  idField?: string;
}): FieldDiff {
  const { input, current, recordType } = args;
  const idField = args.idField ?? "id";
  const keys = Object.keys(input).filter((key) => key !== idField);

  if (current === null) {
    return {
      kind: "create",
      recordType,
      fields: keys.map((name) => ({ name, after: input[name] })),
    };
  }

  const fields = keys
    .filter((name) => !sameValue(current[name], input[name]))
    .map((name) => ({ name, before: current[name], after: input[name] }));

  const rawId = current[idField] ?? input[idField];
  const rawUpdatedAt = current.updated_at;
  return {
    kind: "update",
    recordType,
    ...(rawId !== undefined && rawId !== null ? { recordId: String(rawId) } : {}),
    ...(typeof rawUpdatedAt === "string" ? { baselineUpdatedAt: rawUpdatedAt } : {}),
    fields,
  };
}

export function isDiffStale(diff: FieldDiff, live: Record<string, unknown> | null): boolean {
  if (diff.kind !== "update") return false;
  if (live === null) return true;
  return diff.fields.some((field) => !sameValue(field.before, live[field.name]));
}
