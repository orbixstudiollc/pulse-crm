import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new Response("Microsoft OAuth not configured", { status: 500 });
  }

  const scopes = [
    "Mail.Send",
    "Mail.ReadWrite",
    "User.Read",
    "offline_access",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state: user.id,
  });

  redirect(
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`,
  );
}
