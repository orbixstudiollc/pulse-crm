// Plain module (not "use server") so tests and server actions can share it.

export const ADMIN_ROLES = ["admin", "owner"] as const;

/** Exact, case-sensitive role check. Missing roles never pass. */
export function hasRequiredRole(
  role: string | null | undefined,
  allowed: readonly string[] = ADMIN_ROLES,
): boolean {
  if (!role) return false;
  return allowed.includes(role);
}
