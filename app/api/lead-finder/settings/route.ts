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

    const { data: aiRows } = await supabase
      .from("ai_settings")
      .select("api_key, apify_api_key, openrouter_api_key, default_model, ai_provider, parallel_enrichment_limit")
      .eq("organization_id", profile.organization_id)
      .limit(1);
    const ai = aiRows?.[0] ?? null;

    const { data: org } = await admin
      .from("organizations")
      .select("id, name, agency_type, agency_description, services, results_case_studies, target_industries, agency_website")
      .eq("id", profile.organization_id)
      .single();

    const mask = (key: string | null | undefined) =>
      key ? `${"•".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : "";

    return NextResponse.json({
      data: {
        apify_token: mask(ai?.apify_api_key),
        ai_provider: ai?.ai_provider ?? "openrouter",
        anthropic_api_key: mask(ai?.api_key),
        openrouter_api_key: mask(ai?.openrouter_api_key),
        ai_model: ai?.default_model ?? "anthropic/claude-sonnet-4",
        enrichment_concurrency: String(ai?.parallel_enrichment_limit ?? 1),
        agency_name: org?.name ?? "",
        agency_type: org?.agency_type ?? "general",
        agency_description: org?.agency_description ?? "",
        agency_services: org?.services ?? "",
        agency_results: org?.results_case_studies ?? "",
        agency_target_industries: org?.target_industries ?? "",
        agency_website: org?.agency_website ?? "",
      },
    }, {
      headers: { "Cache-Control": "no-store" },
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
    const orgId = profile.organization_id;

    if (section === "keys") {
      const aiUpdates: Record<string, unknown> = {};
      const isMasked = (v: string) => !v || String(v).includes("•");

      if (body.apify_token && !isMasked(body.apify_token))
        aiUpdates.apify_api_key = body.apify_token;
      if (body.anthropic_api_key && !isMasked(body.anthropic_api_key))
        aiUpdates.api_key = body.anthropic_api_key;
      if (body.openrouter_api_key && !isMasked(body.openrouter_api_key))
        aiUpdates.openrouter_api_key = body.openrouter_api_key;
      if (body.ai_provider)
        aiUpdates.ai_provider = body.ai_provider;
      if (body.ai_model)
        aiUpdates.default_model = body.ai_model;
      // Ollama-specific fields stored in default_model
      if (body.anthropic_model)
        aiUpdates.default_model = body.anthropic_model;
      if (body.ollama_model)
        aiUpdates.default_model = body.ollama_model;
      if (body.ollama_base_url)
        aiUpdates.default_model = `ollama:${body.ollama_base_url}:${body.ollama_model || "qwen2.5-coder"}`;

      if (Object.keys(aiUpdates).length > 0) {
        const { data: updated, error: updateError } = await supabase
          .from("ai_settings")
          .update(aiUpdates)
          .eq("organization_id", orgId)
          .select("id");

        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

        if (!updated || updated.length === 0) {
          const { error: insertError } = await supabase
            .from("ai_settings")
            .insert({ organization_id: orgId, ...aiUpdates });
          if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    if (section === "enrichment") {
      const limit = parseInt(body.enrichment_concurrency, 10);
      if (!isNaN(limit) && limit > 0) {
        const { data: updated } = await supabase
          .from("ai_settings")
          .update({ parallel_enrichment_limit: limit })
          .eq("organization_id", orgId)
          .select("id");

        if (!updated || updated.length === 0) {
          await supabase
            .from("ai_settings")
            .insert({ organization_id: orgId, parallel_enrichment_limit: limit });
        }
      }
    }

    if (section === "agency") {
      const orgUpdates: Record<string, string> = {};
      if (typeof body.agency_name === "string") orgUpdates.name = body.agency_name;
      if (typeof body.agency_type === "string") orgUpdates.agency_type = body.agency_type;
      if (typeof body.agency_description === "string") orgUpdates.agency_description = body.agency_description;
      if (typeof body.agency_services === "string") orgUpdates.services = body.agency_services;
      if (typeof body.agency_results === "string") orgUpdates.results_case_studies = body.agency_results;
      if (typeof body.agency_target_industries === "string") orgUpdates.target_industries = body.agency_target_industries;
      if (typeof body.agency_website === "string") orgUpdates.agency_website = body.agency_website;

      if (Object.keys(orgUpdates).length > 0) {
        const { error } = await admin
          .from("organizations")
          .update(orgUpdates)
          .eq("id", orgId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
