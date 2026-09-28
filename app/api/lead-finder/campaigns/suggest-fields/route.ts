import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { suggestLeadFields } from "@/lib/lead-finder/ai/campaign-planner";

const AIProviderEnum = z.enum([
  "openai",
  "anthropic",
  "openrouter",
  "groq",
  "ollama",
  "ollama_cloud",
]);

const BodySchema = z.object({
  targetNiche: z
    .string()
    .trim()
    .min(1, "targetNiche is required")
    .max(2_000),
  aiProvider: AIProviderEnum.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();

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
    const { targetNiche, aiProvider } = parsed.data;

    const fields = await suggestLeadFields(
      targetNiche,
      orgId,
      aiProvider || "anthropic"
    );

    return NextResponse.json({
      data: {
        kpi_definitions: [],
        lead_field_definitions: fields.map((f) => ({
          id: f.id,
          label: f.label,
          description: f.description ?? "",
          type: f.type,
        })),
      },
    });
  } catch (err) {
    console.error("[lead-finder/suggest-fields] error", err);
    return NextResponse.json(
      { error: "Failed to suggest fields" },
      { status: 500 }
    );
  }
}
