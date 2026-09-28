// Open-access mode: visitors get a throwaway anonymous user and their own
// workspace instead of seeing login or sign-up. Switched by
// NEXT_PUBLIC_OPEN_ACCESS=true (build-time; referenced literally so Next can
// inline it in client components too).

export function isOpenAccess(value: string | undefined = process.env.NEXT_PUBLIC_OPEN_ACCESS): boolean {
  return value === "true";
}

export const AUTH_PAGES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/onboarding",
] as const;

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export const GUEST_EMAIL_DOMAIN = "guest.local";
export const GUEST_WORKSPACE_NAME = "Guest workspace";

export function guestWorkspaceSlug(userId: string, now: number = Date.now()): string {
  return `guest-${userId.replace(/-/g, "").slice(0, 8)}-${now}`;
}

export function isGuestEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.endsWith("@" + GUEST_EMAIL_DOMAIN);
}
