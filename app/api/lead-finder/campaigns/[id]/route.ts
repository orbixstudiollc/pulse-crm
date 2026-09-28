import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/security";
import {
  getLFCampaignById,
  updateLFCampaign,
  deleteLFCampaign,
} from "@/lib/actions/lead-finder/campaigns";

const ActorIdString = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9._\-/~]+$/, "Invalid actor id");

const MIN_ENRICHMENT_CONCURRENCY = 1;
const MAX_ENRICHMENT_CONCURRENCY = 50;
const MIN_ACTOR_NUMERIC_INPUT = 1;
const MAX_ACTOR_NUMERIC_INPUT = 500;
const ACTOR_LIMIT_KEY_RE = /(max|limit|pages|results|jobs|reviews|per)/i;

// Allowlist of updatable columns (mirrors lib/actions/lead-finder/campaigns.ts).
const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5_000).nullish(),
    target_niche: z.string().trim().max(500).optional(),
    apify_actors: z.array(ActorIdString).max(500).optional(),
    actor_configs: z
      .record(z.string().max(200), z.record(z.string(), z.unknown()))
      .optional(),
    kpi_definitions: z.array(z.unknown()).max(1_000).optional(),
    lead_field_definitions: z.array(z.unknown()).max(1_000).optional(),
    schedule_frequency: z.enum(["once", "daily", "weekly"]).optional(),
    ai_provider: z
      .enum([
        "anthropic",
        "openai",
        "openrouter",
        "groq",
        "ollama",
        "ollama_cloud",
      ])
      .optional(),
    auto_enrich: z.boolean().optional(),
    max_leads_per_run: z.coerce.number().int().min(1).max(100_000).optional(),
    max_pages_per_search: z.coerce.number().int().min(1).max(1_000).optional(),
    enrichment_concurrency: z.coerce.number().int().optional(),
    status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getLFCampaignById(id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error("[lead-finder/campaigns/:id] GET error", err);
    return NextResponse.json(
      { error: "Failed to load campaign" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { ...parsed.data };

    if (updates.enrichment_concurrency !== undefined) {
      const raw = Number(updates.enrichment_concurrency);
      if (!Number.isFinite(raw) || raw <= 0) {
        updates.enrichment_concurrency = MIN_ENRICHMENT_CONCURRENCY;
      } else {
        updates.enrichment_concurrency = Math.min(
          Math.max(Math.trunc(raw), MIN_ENRICHMENT_CONCURRENCY),
          MAX_ENRICHMENT_CONCURRENCY
        );
      }
    }

    if (updates.actor_configs && typeof updates.actor_configs === "object") {
      const actorConfigs = updates.actor_configs as Record<
        string,
        Record<string, unknown>
      >;
      for (const [actorId, cfg] of Object.entries(actorConfigs)) {
        if (!cfg || typeof cfg !== "object") continue;
        const nextCfg: Record<string, unknown> = { ...cfg };
        for (const [key, rawVal] of Object.entries(nextCfg)) {
          if (typeof rawVal !== "number" || !Number.isFinite(rawVal)) continue;
          if (!ACTOR_LIMIT_KEY_RE.test(key)) continue;
          nextCfg[key] = Math.min(
            Math.max(Math.trunc(rawVal), MIN_ACTOR_NUMERIC_INPUT),
            MAX_ACTOR_NUMERIC_INPUT
          );
        }
        actorConfigs[actorId] = nextCfg;
      }
      updates.actor_configs = actorConfigs;
    }

    const result = await updateLFCampaign(id, updates);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error("[lead-finder/campaigns/:id] PUT error", err);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await deleteLFCampaign(id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[lead-finder/campaigns/:id] DELETE error", err);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
