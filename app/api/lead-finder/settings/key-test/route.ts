import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";

export async function GET() {
  try {
    const orgId = await getOrgId();
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from("ai_settings")
      .select("api_key, apify_api_key, openrouter_api_key")
      .eq("organization_id", orgId)
      .limit(1);

    const data = rows?.[0] ?? null;

    return NextResponse.json({
      orgId,
      queryError: error?.message ?? null,
      rowCount: rows?.length ?? 0,
      hasRow: !!data,
      hasAnthropicInDB: !!data?.api_key,
      hasApifyInDB: !!data?.apify_api_key,
      hasOpenRouterInDB: !!data?.openrouter_api_key,
      envAnthropicSet: !!process.env.ANTHROPIC_API_KEY,
      envOpenRouterSet: !!process.env.OPENROUTER_API_KEY,
      envApifySet: !!process.env.APIFY_TOKEN,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
