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

// Crawlers and link-preview fetchers must not mint anonymous users. "bot" must
// be a standalone word or a suffix ending the token (Googlebot/2.1, AhrefsBot),
// so brand names that merely contain it (CUBOT phones) are not blocked.
export const BOT_UA_RE =
  /(^|[^a-z])bot([^a-z]|$)|[a-z]+(?<!\bcu)bot(\/|[\s;)-]|$)|crawler|spider|preview|facebookexternalhit|slackbot/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  return typeof ua === "string" && BOT_UA_RE.test(ua);
}

export const GUEST_SIGNUPS_PER_HOUR_DEFAULT = 200;

export function guestSignupsPerHour(env: string | undefined = process.env.GUEST_SIGNUPS_PER_HOUR): number {
  const n = Number(env);
  return Number.isInteger(n) && n > 0 ? n : GUEST_SIGNUPS_PER_HOUR_DEFAULT;
}

// Fails closed: an unavailable count (null) counts as the cap being reached.
export function isGuestCapReached(recentCount: number | null, limit: number): boolean {
  return recentCount === null || recentCount >= limit;
}
