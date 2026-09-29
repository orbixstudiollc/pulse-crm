import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { assertSafeFetchUrl } from "@/lib/security";
import { assertSafeFetchTarget } from "@/lib/security/fetch-target";

const AIProviderEnum = z.enum([
  "anthropic",
  "openai",
  "openrouter",
  "groq",
  "ollama",
  "ollama_cloud",
]);

const KeysSection = z.object({
  section: z.literal("keys"),
  apify_token: z.string().max(1_024).optional(),
  anthropic_api_key: z.string().max(1_024).optional(),
  openrouter_api_key: z.string().max(1_024).optional(),
  openai_api_key: z.string().max(1_024).optional(),
  groq_api_key: z.string().max(1_024).optional(),
  ai_provider: AIProviderEnum.optional(),
  ai_model: z.string().trim().max(200).optional(),
  anthropic_model: z.string().trim().max(200).optional(),
  ollama_model: z.string().trim().max(200).optional(),
  ollama_base_url: z
    .string()
    .trim()
    .max(500)
    .regex(
      /^https?:\/\//i,
      "ollama_base_url must start with http:// or https://"
    )
    // SECURITY: reject URLs pointing at private, loopback, link-local, or
    // metadata hosts. A tenant must not be able to proxy server-side fetches
    // toward internal infrastructure (SSRF).
    .refine((raw) => {
      try {
        assertSafeFetchUrl(raw);
        return true;
      } catch {
        return false;
      }
    }, "ollama_base_url points at a disallowed host")
    .optional(),
});

const EnrichmentSection = z.object({
  section: z.literal("enrichment"),
  enrichment_concurrency: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number.parseInt(v, 10)))
    .pipe(z.number().int().min(1).max(100)),
});

const AgencySection = z.object({
  section: z.literal("agency"),
  agency_name: z.string().trim().max(200).optional(),
  agency_type: z.string().trim().max(100).optional(),
  agency_description: z.string().trim().max(5_000).optional(),
  agency_services: z.string().trim().max(5_000).optional(),
  agency_results: z.string().trim().max(5_000).optional(),
  agency_target_industries: z.string().trim().max(2_000).optional(),
  agency_website: z.string().trim().max(2_048).optional(),
});

const ObsidianSection = z.object({
  section: z.literal("obsidian"),
  obsidian_vault_path: z.string().trim().max(500).optional(),
  obsidian_sync_enabled: z.boolean().optional(),
});

const SettingsSchema = z.discriminatedUnion("section", [
  KeysSection,
  EnrichmentSection,
  AgencySection,
  ObsidianSection,
]);

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

    const { data: aiRows } = await admin
      .from("ai_settings")
      .select(
        "api_key, apify_api_key, openrouter_api_key, openrouter_oauth_token, openrouter_expires_at, openai_api_key, groq_api_key, ollama_base_url, obsidian_vault_path, obsidian_sync_enabled, default_model, ai_provider, parallel_enrichment_limit"
      )
      .eq("organization_id", profile.organization_id)
      .limit(1);
    const ai = aiRows?.[0] ?? null;

    const { data: org } = await admin
      .from("organizations")
      .select(
        "id, name, agency_type, agency_description, services, results_case_studies, target_industries, agency_website"
      )
      .eq("id", profile.organization_id)
      .single();

    const mask = (key: string | null | undefined) =>
      key ? `${"•".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : "";

    const openrouterOauthActive = !!(
      ai?.openrouter_oauth_token &&
      (!ai?.openrouter_expires_at ||
        new Date(ai.openrouter_expires_at).getTime() > Date.now())
    );

    return NextResponse.json(
      {
        data: {
          apify_token: mask(ai?.apify_api_key),
          ai_provider: ai?.ai_provider ?? "openrouter",
          anthropic_api_key: mask(ai?.api_key),
          openrouter_api_key: mask(ai?.openrouter_api_key),
          openai_api_key: mask(ai?.openai_api_key),
          groq_api_key: mask(ai?.groq_api_key),
          ollama_base_url: ai?.ollama_base_url ?? "",
          openrouter_oauth_active: openrouterOauthActive,
          has_apify: !!ai?.apify_api_key,
          has_anthropic: !!ai?.api_key,
          has_openrouter: !!(ai?.openrouter_api_key || openrouterOauthActive),
          has_openai: !!ai?.openai_api_key,
          has_groq: !!ai?.groq_api_key,
          has_ollama: !!ai?.ollama_base_url,
          ai_model: ai?.default_model ?? "anthropic/claude-sonnet-4",
          enrichment_concurrency: String(ai?.parallel_enrichment_limit ?? 1),
          agency_name: org?.name ?? "",
          agency_type: org?.agency_type ?? "general",
          agency_description: org?.agency_description ?? "",
          agency_services: org?.services ?? "",
          agency_results: org?.results_case_studies ?? "",
          agency_target_industries: org?.target_industries ?? "",
          agency_website: org?.agency_website ?? "",
          obsidian_vault_path: ai?.obsidian_vault_path ?? "",
          obsidian_sync_enabled: !!ai?.obsidian_sync_enabled,
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    console.error("[lead-finder/settings] GET error", err);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
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

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = SettingsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // SECURITY (SSRF): the zod refine only checks the literal host; also
    // reject hostnames that resolve to private addresses.
    if (body.section === "keys" && body.ollama_base_url) {
      try {
        await assertSafeFetchTarget(body.ollama_base_url);
      } catch {
        return NextResponse.json(
          { error: "ollama_base_url is not allowed" },
          { status: 400 }
        );
      }
    }

    const admin = createAdminClient();
    const orgId = profile.organization_id;

    if (body.section === "keys") {
      const aiUpdates: Record<string, unknown> = {};
      const isMasked = (v: string) => !v || String(v).includes("•");

      if (body.apify_token && !isMasked(body.apify_token))
        aiUpdates.apify_api_key = body.apify_token;
      if (body.anthropic_api_key && !isMasked(body.anthropic_api_key))
        aiUpdates.api_key = body.anthropic_api_key;
      if (body.openrouter_api_key && !isMasked(body.openrouter_api_key))
        aiUpdates.openrouter_api_key = body.openrouter_api_key;
      if (body.openai_api_key && !isMasked(body.openai_api_key))
        aiUpdates.openai_api_key = body.openai_api_key;
      if (body.groq_api_key && !isMasked(body.groq_api_key))
        aiUpdates.groq_api_key = body.groq_api_key;
      if (body.ai_provider) aiUpdates.ai_provider = body.ai_provider;
      if (body.ai_model) aiUpdates.default_model = body.ai_model;
      // Provider-specific model overrides; the Ollama base URL has its own column
      if (body.anthropic_model)
        aiUpdates.default_model = body.anthropic_model;
      if (body.ollama_model) aiUpdates.default_model = body.ollama_model;
      if (body.ollama_base_url) aiUpdates.ollama_base_url = body.ollama_base_url;

      if (Object.keys(aiUpdates).length > 0) {
        const { data: updated, error: updateError } = await supabase
          .from("ai_settings")
          .update(aiUpdates)
          .eq("organization_id", orgId)
          .select("id");

        if (updateError)
          return NextResponse.json(
            { error: updateError.message },
            { status: 500 }
          );

        if (!updated || updated.length === 0) {
          const { error: insertError } = await supabase
            .from("ai_settings")
            .insert({ organization_id: orgId, ...aiUpdates });
          if (insertError)
            return NextResponse.json(
              { error: insertError.message },
              { status: 500 }
            );
        }
      }
    }

    if (body.section === "enrichment") {
      const limit = body.enrichment_concurrency;
      const { data: updated } = await supabase
        .from("ai_settings")
        .update({ parallel_enrichment_limit: limit })
        .eq("organization_id", orgId)
        .select("id");

      if (!updated || updated.length === 0) {
        await supabase.from("ai_settings").insert({
          organization_id: orgId,
          parallel_enrichment_limit: limit,
        });
      }
    }

    if (body.section === "agency") {
      const orgUpdates: Record<string, string> = {};
      if (typeof body.agency_name === "string")
        orgUpdates.name = body.agency_name;
      if (typeof body.agency_type === "string")
        orgUpdates.agency_type = body.agency_type;
      if (typeof body.agency_description === "string")
        orgUpdates.agency_description = body.agency_description;
      if (typeof body.agency_services === "string")
        orgUpdates.services = body.agency_services;
      if (typeof body.agency_results === "string")
        orgUpdates.results_case_studies = body.agency_results;
      if (typeof body.agency_target_industries === "string")
        orgUpdates.target_industries = body.agency_target_industries;
      if (typeof body.agency_website === "string")
        orgUpdates.agency_website = body.agency_website;

      if (Object.keys(orgUpdates).length > 0) {
        const { error } = await admin
          .from("organizations")
          .update(orgUpdates)
          .eq("id", orgId);
        if (error) {
          console.error("[lead-finder/settings] org update error", error);
          return NextResponse.json(
            { error: "Failed to save agency settings" },
            { status: 500 }
          );
        }
      }
    }

    if (body.section === "obsidian") {
      const aiUpdates: Record<string, unknown> = {};
      if (typeof body.obsidian_vault_path === "string")
        aiUpdates.obsidian_vault_path = body.obsidian_vault_path;
      if (typeof body.obsidian_sync_enabled === "boolean")
        aiUpdates.obsidian_sync_enabled = body.obsidian_sync_enabled;

      if (Object.keys(aiUpdates).length > 0) {
        const { data: updated } = await supabase
          .from("ai_settings")
          .update(aiUpdates)
          .eq("organization_id", orgId)
          .select("id");

        if (!updated || updated.length === 0) {
          await supabase
            .from("ai_settings")
            .insert({ organization_id: orgId, ...aiUpdates });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[lead-finder/settings] PUT error", err);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
