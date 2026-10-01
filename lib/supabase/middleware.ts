import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  guestSignupsPerHour,
  clientFetchRecoveryInit,
  isAuthPage,
  isClientFetch,
  isGuestCapReached,
  isOpenAccess,
  shouldProvisionGuest,
} from "@/lib/auth/open-access";
import { ensureGuestWorkspace } from "@/lib/auth/guest-workspace";
import { countRecentGuestWorkspaces } from "@/lib/auth/guest-cap";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// A redirect must carry any session cookies set during this request (for
// example right after an anonymous sign-in), or the next request is logged out.
function redirectWithCookies(request: NextRequest, pathname: string, from: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const res = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) res.cookies.set(cookie);
  return res;
}

// API paths that authenticate via headers/body (not cookies) and therefore do
// not need the same-origin CSRF guard. Keep this list small and explicit.
const CSRF_EXEMPT_PREFIXES = [
  "/api/cron/",
  "/api/email/webhook/",
  "/api/whatsapp/webhook",
  "/api/tracking",
  "/api/public/",
  "/api/linkedin/oauth",
  "/api/email/oauth/",
];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

const PROTECTED_PREFIXES = ["/dashboard", "/calendar", "/compose", "/drafts", "/connections", "/team"] as const;
const isProtectedPath = (p: string) => PROTECTED_PREFIXES.some((x) => p === x || p.startsWith(x + "/"));

export async function updateSession(request: NextRequest) {
  // SECURITY: enforce a same-origin guard on cookie-authenticated mutating
  // API requests. This complements Supabase's SameSite=Lax cookies and blocks
  // browser-based CSRF attempts from third-party origins.
  const { pathname, origin } = request.nextUrl;
  const method = request.method.toUpperCase();

  if (
    pathname.startsWith("/api/") &&
    !SAFE_METHODS.has(method) &&
    !isCsrfExempt(pathname)
  ) {
    const requestOrigin = request.headers.get("origin");
    if (!requestOrigin || requestOrigin !== origin) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 }
      );
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // Open-access mode (testing phase): no login or sign-up. A visitor without a
  // session gets an anonymous user and a guest workspace of their own, and the
  // auth pages send them straight to the dashboard.
  const openAccess = isOpenAccess();
  // /api/* never triggers a sign-in: this only matches protected paths, "/" and auth pages.
  if (openAccess && !user && (isProtectedPath(pathname) || pathname === "/" || isAuthPage(pathname))) {
    const secFetchMode = request.headers.get("sec-fetch-mode");
    const secFetchDest = request.headers.get("sec-fetch-dest");
    if (isClientFetch({ method, secFetchMode, secFetchDest })) {
      // A client-side navigation or prefetch after the session vanished. A
      // non-2xx, non-RSC response makes the Next router do a full page load of
      // this URL, which arrives as a real navigation and can be provisioned;
      // prefetches discard it. Stale auth cookies cleared above are still sent.
      const res = new NextResponse(null, clientFetchRecoveryInit());
      for (const cookie of supabaseResponse.cookies.getAll()) res.cookies.set(cookie);
      return res;
    }
    const provision = shouldProvisionGuest({
      method,
      accept: request.headers.get("accept"),
      secFetchMode,
      secFetchDest,
      userAgent: request.headers.get("user-agent"),
    });
    if (!provision) {
      // No session for bots, HEAD, curl/monitors or non-GET fetches; they
      // fall through to the /login redirect.
    } else if (
      isGuestCapReached(await countRecentGuestWorkspaces(new Date(Date.now() - 3_600_000)), guestSignupsPerHour())
    ) {
      return NextResponse.rewrite(new URL("/try-later", request.url), {
        status: 503,
        headers: { "Retry-After": "3600" },
      });
    } else {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data.user) {
        user = data.user;
        await ensureGuestWorkspace(data.user.id);
      }
    }
  }
  if (openAccess && user && isAuthPage(pathname)) {
    // Only skip the auth pages when a workspace exists, so a failed
    // provisioning cannot loop between /onboarding and the dashboard.
    const orgId = await ensureGuestWorkspace(user.id);
    if (orgId) return redirectWithCookies(request, "/dashboard/overview", supabaseResponse);
  }

  // Protect dashboard routes — redirect unauthenticated users to login
  if (!user && isProtectedPath(pathname)) {
    return redirectWithCookies(request, "/login", supabaseResponse);
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
    return redirectWithCookies(request, "/dashboard/overview", supabaseResponse);
  }

  return supabaseResponse;
}
