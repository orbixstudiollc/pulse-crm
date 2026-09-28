/**
 * LinkedIn OAuth2 Flow
 *
 * GET  /api/linkedin/oauth       → Redirect to LinkedIn authorization
 * GET  /api/linkedin/oauth?code= → Handle callback, exchange code for tokens
 *
 * Uses a random CSRF `state` bound to an HttpOnly cookie to prevent login-CSRF
 * / account-linking attacks. The state cookie is consumed on the callback and
 * required to match the `state` query param.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { exchangeOAuthCode } from "@/lib/linkedin/client";
import { saveLinkedInAccount } from "@/lib/actions/linkedin-accounts";
import { timingSafeEqualStr } from "@/lib/security";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pulse-crm-rosy.vercel.app";
const REDIRECT_URI = `${APP_URL}/api/linkedin/oauth`;

const STATE_COOKIE = "li_oauth_state";
const STATE_COOKIE_MAX_AGE = 10 * 60; // 10 minutes

const SCOPES = ["r_liteprofile", "r_emailaddress", "w_member_social"].join(" ");

function redirectToSettings(params: Record<string, string>): NextResponse {
  const url = new URL(`${APP_URL}/dashboard/settings`);
  url.searchParams.set("tab", "linkedin");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    const errorDescription =
      searchParams.get("error_description") || "Authorization denied";
    return redirectToSettings({ error: errorDescription });
  }

  // No code → initiate OAuth flow.
  if (!code) {
    if (!LINKEDIN_CLIENT_ID) {
      return redirectToSettings({
        error: "LinkedIn Client ID not configured",
      });
    }

    const state = randomBytes(24).toString("hex");
    const authUrl = new URL(
      "https://www.linkedin.com/oauth/v2/authorization"
    );
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", LINKEDIN_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("state", state);

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

  // Callback path: validate state.
  const providedState = searchParams.get("state") ?? "";
  const expectedState = request.cookies.get(STATE_COOKIE)?.value ?? "";

  if (
    !providedState ||
    !expectedState ||
    !timingSafeEqualStr(providedState, expectedState)
  ) {
    const res = redirectToSettings({ error: "Invalid OAuth state" });
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const result = await exchangeOAuthCode(
    code,
    REDIRECT_URI,
    LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET
  );

  if (result.error || !result.accessToken) {
    const res = redirectToSettings({
      error: result.error || "Token exchange failed",
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const saveResult = await saveLinkedInAccount({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    scopes: SCOPES.split(" "),
  });

  if (!saveResult.success) {
    const res = redirectToSettings({
      error: saveResult.error || "Failed to save account",
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const res = redirectToSettings({ success: "true" });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
