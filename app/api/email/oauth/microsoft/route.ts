import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "Microsoft OAuth is not configured. Please add MICROSOFT_CLIENT_ID and MICROSOFT_REDIRECT_URI to your environment variables.",
      },
      { status: 500 },
    );
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

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

  return NextResponse.json({ url: authUrl });
}
