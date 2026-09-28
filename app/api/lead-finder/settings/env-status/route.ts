import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getApifyTokenFromEnv } from "@/lib/lead-finder/apify/token";

/**
 * Reports which lead-finder integrations are configured for the caller's org.
 *
 * SECURITY notes:
 * - Never reports whether CRON_SECRET is set (that's an internal deployment
 *   concern and exposing it would help a targeted attacker).
 * - Never reveals the source (env vs DB) beyond a boolean flag.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

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
      apify: { configured: dbApify || !!getApifyTokenFromEnv() },
      openrouter: {
        configured: dbOpenRouter || !!process.env.OPENROUTER_API_KEY,
      },
      anthropic: {
        configured: dbAnthropic || !!process.env.ANTHROPIC_API_KEY,
      },
      ollama_cloud: {
        configured: !!process.env.OLLAMA_CLOUD_API_KEY,
      },
      groq: {
        configured: !!process.env.GROQ_API_KEY,
      },
    };

    return NextResponse.json({ data: status });
  } catch (err) {
    console.error("[lead-finder/settings/env-status] error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
