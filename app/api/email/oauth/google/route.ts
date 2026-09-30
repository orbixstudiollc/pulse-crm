import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { createOAuthState } from "@/lib/security/oauth-state";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in first." },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!hasRequiredRole(profile?.role)) {
    return NextResponse.json(
      { error: "Only organization admins can connect email accounts" },
      { status: 403 },
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "Gmail OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI to your environment variables.",
      },
      { status: 500 },
    );
  }

  const scopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const state = createOAuthState();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state, // CSRF protection, checked against the cookie in the callback
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const response = NextResponse.json({ url: authUrl });
  response.cookies.set("oauth_state_google", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/email/oauth",
  });
  return response;
}
