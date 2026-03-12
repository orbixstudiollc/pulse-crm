/**
 * LinkedIn OAuth2 Flow
 *
 * GET  /api/linkedin/oauth       → Redirect to LinkedIn authorization
 * GET  /api/linkedin/oauth?code= → Handle callback, exchange code for tokens
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeOAuthCode } from "@/lib/linkedin/client";
import { saveLinkedInAccount } from "@/lib/actions/linkedin-accounts";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pulse-crm-rosy.vercel.app";
const REDIRECT_URI = `${APP_URL}/api/linkedin/oauth`;

const SCOPES = [
  "r_liteprofile",
  "r_emailaddress",
  "w_member_social",
].join(" ");

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Handle error from LinkedIn
  if (error) {
    const errorDescription = searchParams.get("error_description") || "Authorization denied";
    return NextResponse.redirect(
      `${APP_URL}/dashboard/settings?tab=linkedin&error=${encodeURIComponent(errorDescription)}`
    );
  }

  // If no code, initiate OAuth flow
  if (!code) {
    if (!LINKEDIN_CLIENT_ID) {
      return NextResponse.redirect(
        `${APP_URL}/dashboard/settings?tab=linkedin&error=${encodeURIComponent("LinkedIn Client ID not configured")}`
      );
    }

    const state = crypto.randomUUID();
    const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", LINKEDIN_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  }

  // Exchange code for tokens
  const result = await exchangeOAuthCode(
    code,
    REDIRECT_URI,
    LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET
  );

  if (result.error || !result.accessToken) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/settings?tab=linkedin&error=${encodeURIComponent(result.error || "Token exchange failed")}`
    );
  }

  // Save the account
  const saveResult = await saveLinkedInAccount({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    scopes: SCOPES.split(" "),
  });

  if (!saveResult.success) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/settings?tab=linkedin&error=${encodeURIComponent(saveResult.error || "Failed to save account")}`
    );
  }

  return NextResponse.redirect(
    `${APP_URL}/dashboard/settings?tab=linkedin&success=true`
  );
}
