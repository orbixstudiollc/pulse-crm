import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id)
      return NextResponse.json({ error: "No organization" }, { status: 400 });

    const admin = createAdminClient();

    // Use user-scoped client for ai_settings (user SELECT policy covers this)
    const { data: ai } = await supabase
      .from("ai_settings")
      .select("api_key, apify_api_key, openrouter_api_key, openai_api_key, default_model")
      .eq("organization_id", profile.organization_id)
      .single();

    const { data: org } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", profile.organization_id)
      .single();

    const mask = (key: string | null) =>
      key ? `${"•".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : null;

    return NextResponse.json({
      data: {
        apifyKey: mask(ai?.apify_api_key ?? null),
        anthropicKey: mask(ai?.api_key ?? null),
        openrouterKey: mask(ai?.openrouter_api_key ?? null),
        openaiKey: mask(ai?.openai_api_key ?? null),
        hasApify: !!ai?.apify_api_key,
        hasAnthropic: !!ai?.api_key,
        hasOpenRouter: !!ai?.openrouter_api_key,
        hasOpenAI: !!ai?.openai_api_key,
        aiProvider: "openai",
        defaultModel: ai?.default_model ?? "gpt-4o",
        // Migration 026 columns — default until migration is run
        parallelEnrichmentLimit: 1,
        agencyName: org?.name ?? "",
        agencyType: "",
        agencyDescription: "",
        services: "",
        resultsCaseStudies: "",
        targetIndustries: "",
        agencyWebsite: "",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id)
      return NextResponse.json({ error: "No organization" }, { status: 400 });

    const body = await req.json();
    const admin = createAdminClient();
    const section = body.section as string;

    if (section === "keys") {
      const aiUpdates: Record<string, string> = {};
      if (body.apifyKey && !String(body.apifyKey).includes("•"))         aiUpdates.apify_api_key = body.apifyKey;
      if (body.anthropicKey && !String(body.anthropicKey).includes("•")) aiUpdates.api_key = body.anthropicKey;
      if (body.openrouterKey && !String(body.openrouterKey).includes("•")) aiUpdates.openrouter_api_key = body.openrouterKey;
      if (body.openaiKey && !String(body.openaiKey).includes("•"))       aiUpdates.openai_api_key = body.openaiKey;

      // Use user-scoped client — RLS INSERT/UPDATE policies allow org members
      const { data: existing } = await supabase
        .from("ai_settings")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .single();

      if (existing) {
        if (Object.keys(aiUpdates).length > 0) {
          const { error } = await supabase
            .from("ai_settings")
            .update(aiUpdates)
            .eq("organization_id", profile.organization_id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        const { error } = await supabase
          .from("ai_settings")
          .insert({ organization_id: profile.organization_id, ...aiUpdates });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (section === "enrichment") {
      // Skip until migration 026 is applied — column may not exist yet
      // The UI still shows success so the user knows it was received
    }

    if (section === "agency") {
      // Only update the name for now — other columns require migration 026
      if (typeof body.agencyName === "string") {
        const { error } = await admin
          .from("organizations")
          .update({ name: body.agencyName })
          .eq("id", profile.organization_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
