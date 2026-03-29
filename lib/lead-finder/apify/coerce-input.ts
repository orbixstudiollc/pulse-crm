import "server-only";

import type { ActorDefinition } from "./registry";

// =============================================================================
// Coerce actor input values to their expected types
// =============================================================================
// Form data arrives as strings; this converts "string-array" fields to actual
// arrays, parses JSON blobs, and converts booleans / numbers where possible.

export function coerceActorInput(
  input: Record<string, unknown>,
  actorDef?: ActorDefinition
): Record<string, unknown> {
  const descriptions = actorDef?.inputFieldDescriptions;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    // Non-string values pass through unchanged
    if (typeof value !== "string") {
      result[key] = value;
      continue;
    }

    const fieldType = descriptions?.[key]?.type;
    let parsed: unknown = undefined;

    // If the field descriptor says string-array, try to parse
    if (fieldType === "string-array") {
      try {
        parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) parsed = undefined;
      } catch {
        // Might be comma-separated
        if (value.includes(",")) {
          parsed = value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }

    // If field type is number, parse it
    if (fieldType === "number") {
      const num = Number(value);
      if (!isNaN(num)) {
        parsed = num;
      }
    }

    // If field type is boolean, parse it
    if (fieldType === "boolean") {
      const lower = value.toLowerCase().trim();
      if (lower === "true" || lower === "1" || lower === "yes") parsed = true;
      else if (lower === "false" || lower === "0" || lower === "no")
        parsed = false;
    }

    // Auto-detect JSON arrays/objects if not yet parsed
    if (parsed === undefined) {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const candidate = JSON.parse(value);
          const isUsable =
            Array.isArray(candidate) ||
            (typeof candidate === "object" &&
              candidate !== null &&
              Object.prototype.toString.call(candidate) ===
                "[object Object]");
          if (isUsable) parsed = candidate;
        } catch {
          // leave as string
        }
      }
    }

    result[key] = parsed !== undefined ? parsed : value;
  }

  return result;
}
