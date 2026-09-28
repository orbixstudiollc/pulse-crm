import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect dashboard routes — redirect unauthenticated users to login
  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup" ||
      request.nextUrl.pathname === "/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/overview";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
