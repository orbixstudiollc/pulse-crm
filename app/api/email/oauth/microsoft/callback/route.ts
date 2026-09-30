import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { sealOAuthTokens } from "@/lib/email/oauth-tokens";
import { hasRequiredRole } from "@/lib/auth/roles";
import { cookies } from "next/headers";
import { stateMatches } from "@/lib/security/oauth-state";

const STATE_COOKIE = "oauth_state_microsoft";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    redirect("/dashboard/settings?error=missing_code");
  }

  // CSRF: state must match the single-use cookie set by the start route
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete({ name: STATE_COOKIE, path: "/api/email/oauth" });

  if (!stateMatches(expectedState, state)) {
    redirect("/dashboard/settings?tab=email-accounts&error=invalid_state");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/dashboard/settings?error=unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    redirect("/dashboard/settings?error=no_org");
  }

  if (!hasRequiredRole(profile.role)) {
    redirect("/dashboard/settings?tab=email-accounts&error=forbidden");
  }

  // Exchange code for tokens
  const tokenRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
      }),
    },
  );

  if (!tokenRes.ok) {
    redirect("/dashboard/settings?error=token_exchange_failed");
  }

  const tokens = await tokenRes.json();

  // Get user profile (email)
  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileRes.ok) {
    redirect("/dashboard/settings?error=ms_profile_failed");
  }

  const msProfile = await profileRes.json();
  const emailAddress =
    msProfile.mail || msProfile.userPrincipalName || msProfile.id;

  // Upsert email account
  const { error: saveError } = await supabase.from("email_accounts").upsert(
    {
      organization_id: profile.organization_id,
      user_id: user.id,
      provider: "microsoft",
      email_address: emailAddress,
      display_name: msProfile.displayName || emailAddress,
      status: "active",
      oauth_tokens: sealOAuthTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope,
      }),
    },
    { onConflict: "organization_id,email_address" },
  );

  if (saveError) {
    redirect("/dashboard/settings?tab=email-accounts&error=save_failed");
  }

  redirect("/dashboard/settings?tab=email-accounts&connected=microsoft");
}
