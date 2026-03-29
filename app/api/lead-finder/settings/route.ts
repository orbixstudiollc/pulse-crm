import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id)
      return NextResponse.json({ error: "No organization" }, { status: 400 });

    const admin = createAdminClient();

    // Get AI settings (api keys)
    const { data: aiSettings } = await admin
      .from("ai_settings")
      .select("api_key, apify_api_key, openrouter_api_key, default_model")
      .eq("organization_id", profile.organization_id)
      .single();

    // Get org details
    const { data: org } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", profile.organization_id)
      .single();

    // Mask keys — only return whether set and last 4 chars
    const mask = (key: string | null) =>
      key ? `${"•".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : null;

    return NextResponse.json({
      data: {
        apifyKey: mask(aiSettings?.apify_api_key ?? null),
        anthropicKey: mask(aiSettings?.api_key ?? null),
        openrouterKey: mask(aiSettings?.openrouter_api_key ?? null),
        defaultModel: aiSettings?.default_model ?? null,
        agencyName: org?.name ?? "",
        // flags for whether keys are set
        hasApify: !!aiSettings?.apify_api_key,
        hasAnthropic: !!aiSettings?.api_key,
        hasOpenRouter: !!aiSettings?.openrouter_api_key,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id)
      return NextResponse.json({ error: "No organization" }, { status: 400 });

    const body = await req.json();
    const admin = createAdminClient();

    // Update AI settings (only update keys that were actually changed — non-empty strings)
    const aiUpdates: Record<string, string> = {};
    if (body.apifyKey && !body.apifyKey.includes("•"))
      aiUpdates.apify_api_key = body.apifyKey;
    if (body.anthropicKey && !body.anthropicKey.includes("•"))
      aiUpdates.api_key = body.anthropicKey;
    if (body.openrouterKey && !body.openrouterKey.includes("•"))
      aiUpdates.openrouter_api_key = body.openrouterKey;

    if (Object.keys(aiUpdates).length > 0) {
      const { error: aiError } = await admin
        .from("ai_settings")
        .upsert(
          { organization_id: profile.organization_id, ...aiUpdates },
          { onConflict: "organization_id" }
        );
      if (aiError)
        return NextResponse.json({ error: aiError.message }, { status: 500 });
    }

    // Update org name if provided
    if (typeof body.agencyName === "string") {
      await admin
        .from("organizations")
        .update({ name: body.agencyName })
        .eq("id", profile.organization_id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
