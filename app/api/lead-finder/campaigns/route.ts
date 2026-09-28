import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getLFCampaigns,
  createLFCampaign,
} from "@/lib/actions/lead-finder/campaigns";

const ActorIdString = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9._\-/~]+$/, "Invalid actor id");

const BodySchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  description: z.string().trim().max(5_000).optional(),
  target_niche: z.string().trim().max(500).optional().default(""),
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
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getLFCampaigns();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error("[lead-finder/campaigns] GET error", err);
    return NextResponse.json(
      { error: "Failed to list campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const result = await createLFCampaign(parsed.data);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (err) {
    console.error("[lead-finder/campaigns] POST error", err);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
