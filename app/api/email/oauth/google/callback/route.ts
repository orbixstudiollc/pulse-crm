import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // user.id

  if (!code || !state) {
    redirect("/dashboard/settings?error=missing_code");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== state) {
    redirect("/dashboard/settings?error=unauthorized");
  }

  // Get org_id from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    redirect("/dashboard/settings?error=no_org");
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    }),
  });

  if (!tokenRes.ok) {
    redirect("/dashboard/settings?error=token_exchange_failed");
  }

  const tokens = await tokenRes.json();

  // Get Gmail profile (email address)
  const profileRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );

  if (!profileRes.ok) {
    redirect("/dashboard/settings?error=gmail_profile_failed");
  }

  const gmailProfile = await profileRes.json();

  // Upsert email account
  await supabase.from("email_accounts").upsert(
    {
      organization_id: profile.organization_id,
      user_id: user.id,
      provider: "gmail",
      email_address: gmailProfile.emailAddress,
      display_name: user.user_metadata?.full_name || gmailProfile.emailAddress,
      status: "active",
      oauth_tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope,
      },
    },
    { onConflict: "organization_id,email_address" },
  );

  redirect("/dashboard/settings?tab=email-accounts&connected=gmail");
}
