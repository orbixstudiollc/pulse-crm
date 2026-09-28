/**
 * OpenRouter OAuth2 with PKCE — initiator.
 *
 * GET /api/lead-finder/auth/openrouter
 *
 * Starts the OpenRouter PKCE flow: generates a random code_verifier + SHA-256
 * code_challenge, persists the verifier on the caller's `ai_settings` row
 * (so the callback can complete the exchange server-to-server without the
 * browser ever seeing the verifier), and redirects the user to the OpenRouter
 * authorization page. A CSRF `state` is bound to an HttpOnly cookie and
 * compared with timing-safe equality on callback.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "orr_oauth_state";
const STATE_COOKIE_MAX_AGE = 10 * 60;

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function redirectToSettings(origin: string, error?: string): NextResponse {
  const url = new URL("/dashboard/lead-finder/settings", origin);
  url.searchParams.set("tab", "ai");
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirectToSettings(origin, "unauthorized");
  }

  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch {
    return redirectToSettings(origin, "no_organization");
  }

  // PKCE material
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = b64url(
    createHash("sha256").update(codeVerifier).digest()
  );
  const state = randomBytes(24).toString("hex");

  // Persist verifier against the org's ai_settings so only the callback
  // (authenticated as the same user) can complete the exchange.
  const { data: existing } = await supabase
    .from("ai_settings")
    .select("id")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (existing) {
    const { error: upErr } = await supabase
      .from("ai_settings")
      .update({
        openrouter_code_verifier: codeVerifier,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId);
    if (upErr) {
      console.error("[openrouter-auth] persist verifier failed", upErr);
      return redirectToSettings(origin, "persist_failed");
    }
  } else {
    const { error: insErr } = await supabase
      .from("ai_settings")
      .insert({
        organization_id: orgId,
        openrouter_code_verifier: codeVerifier,
      } as never);
    if (insErr) {
      console.error("[openrouter-auth] create ai_settings failed", insErr);
      return redirectToSettings(origin, "persist_failed");
    }
  }

  const callbackUrl = new URL(
    "/api/lead-finder/auth/openrouter/callback",
    origin
  ).toString();

  const authUrl = new URL("https://openrouter.ai/auth");
  authUrl.searchParams.set("callback_url", callbackUrl);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE,
  });
  return res;
}
