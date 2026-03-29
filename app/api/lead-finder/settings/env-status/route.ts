import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get org ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    // Get DB-stored keys too
    let dbApify = false;
    let dbAnthropic = false;
    let dbOpenRouter = false;
    if (profile?.organization_id) {
      const admin = createAdminClient();
      const { data: aiSettings } = await admin
        .from("ai_settings")
        .select("api_key, apify_api_key, openrouter_api_key")
        .eq("organization_id", profile.organization_id)
        .single();
      dbApify = !!aiSettings?.apify_api_key;
      dbAnthropic = !!aiSettings?.api_key;
      dbOpenRouter = !!aiSettings?.openrouter_api_key;
    }

    const status = {
      apify: {
        configured: dbApify || !!process.env.APIFY_TOKEN,
        source: dbApify ? "settings" : process.env.APIFY_TOKEN ? "env" : null,
      },
      openrouter: {
        configured: dbOpenRouter || !!process.env.OPENROUTER_API_KEY,
        source: dbOpenRouter ? "settings" : process.env.OPENROUTER_API_KEY ? "env" : null,
      },
      anthropic: {
        configured: dbAnthropic || !!process.env.ANTHROPIC_API_KEY,
        source: dbAnthropic ? "settings" : process.env.ANTHROPIC_API_KEY ? "env" : null,
      },
      cronSecret: {
        configured: !!process.env.CRON_SECRET,
      },
    };

    return NextResponse.json({ data: status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
