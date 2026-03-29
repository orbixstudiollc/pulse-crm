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

    const { data: ai } = await admin
      .from("ai_settings")
      .select("api_key, apify_api_key, openrouter_api_key, openai_api_key, ai_provider, default_model, parallel_enrichment_limit")
      .eq("organization_id", profile.organization_id)
      .single();

    const { data: org } = await admin
      .from("organizations")
      .select("id, name, agency_type, agency_description, services, results_case_studies, target_industries, agency_website")
      .eq("id", profile.organization_id)
      .single();

    const mask = (key: string | null) =>
      key ? `${"•".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : null;

    return NextResponse.json({
      data: {
        // API keys (masked)
        apifyKey: mask(ai?.apify_api_key ?? null),
        anthropicKey: mask(ai?.api_key ?? null),
        openrouterKey: mask(ai?.openrouter_api_key ?? null),
        openaiKey: mask(ai?.openai_api_key ?? null),
        // flags
        hasApify: !!ai?.apify_api_key,
        hasAnthropic: !!ai?.api_key,
        hasOpenRouter: !!ai?.openrouter_api_key,
        hasOpenAI: !!ai?.openai_api_key,
        // AI config
        aiProvider: ai?.ai_provider ?? "openai",
        defaultModel: ai?.default_model ?? "gpt-4o",
        parallelEnrichmentLimit: ai?.parallel_enrichment_limit ?? 1,
        // Agency profile
        agencyName: org?.name ?? "",
        agencyType: org?.agency_type ?? "",
        agencyDescription: org?.agency_description ?? "",
        services: org?.services ?? "",
        resultsCaseStudies: org?.results_case_studies ?? "",
        targetIndustries: org?.target_industries ?? "",
        agencyWebsite: org?.agency_website ?? "",
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
    const section = body.section; // "keys" | "enrichment" | "agency"

    if (section === "keys") {
      const aiUpdates: Record<string, string | number> = {};
      if (body.apifyKey && !body.apifyKey.includes("•"))   aiUpdates.apify_api_key = body.apifyKey;
      if (body.anthropicKey && !body.anthropicKey.includes("•")) aiUpdates.api_key = body.anthropicKey;
      if (body.openrouterKey && !body.openrouterKey.includes("•")) aiUpdates.openrouter_api_key = body.openrouterKey;
      if (body.openaiKey && !body.openaiKey.includes("•")) aiUpdates.openai_api_key = body.openaiKey;
      if (body.aiProvider) aiUpdates.ai_provider = body.aiProvider;

      const { error } = await admin
        .from("ai_settings")
        .upsert({ organization_id: profile.organization_id, ...aiUpdates }, { onConflict: "organization_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (section === "enrichment") {
      const limit = Number(body.parallelEnrichmentLimit);
      if (!isNaN(limit) && limit >= 1 && limit <= 10) {
        const { error } = await admin
          .from("ai_settings")
          .upsert(
            { organization_id: profile.organization_id, parallel_enrichment_limit: limit },
            { onConflict: "organization_id" }
          );
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (section === "agency") {
      const { error } = await admin
        .from("organizations")
        .update({
          name: body.agencyName ?? undefined,
          agency_type: body.agencyType ?? undefined,
          agency_description: body.agencyDescription ?? undefined,
          services: body.services ?? undefined,
          results_case_studies: body.resultsCaseStudies ?? undefined,
          target_industries: body.targetIndustries ?? undefined,
          agency_website: body.agencyWebsite ?? undefined,
        })
        .eq("id", profile.organization_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
