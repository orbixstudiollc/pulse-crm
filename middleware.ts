import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public assets (images, svgs, etc.)
     * - /api/mcp (API-key auth; skipping the session refresh keeps MCP connects fast)
     * - /api/csp-report (cookie-less browser reports; no session refresh needed)
     */
    "/((?!_next/static|_next/image|favicon.ico|images|api/mcp|api/csp-report|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
