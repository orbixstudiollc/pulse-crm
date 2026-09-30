import { randomBytes, timingSafeEqual } from "node:crypto";

/** Random, unguessable OAuth `state` value (32 bytes, base64url). */
export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

/** Timing-safe comparison of the cookie value with the returned `state`. */
export function stateMatches(
  expected: string | undefined,
  actual: string | null,
): boolean {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
