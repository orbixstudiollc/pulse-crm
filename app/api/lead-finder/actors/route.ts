import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { getAllActors } from "@/lib/lead-finder/apify/registry-server";

const ActorIdString = z
  .string()
  .trim()
  .min(1, "actorId is required")
  .max(200, "actorId too long")
  // Apify actor ids must be in `username/actor-name` form
  .regex(/^[a-zA-Z0-9._\-/~]+$/, "Invalid actorId")
  .refine(
    (v) => v.includes("/"),
    "Actor ID must be in format: username/actor-name"
  );

const BodySchema = z.object({
  actorId: ActorIdString,
  name: z.string().trim().min(1, "name is required").max(200),
  phase: z.enum(["find", "enrich"]),
  description: z.string().trim().max(5_000).optional(),
  requiredInputFields: z
    .array(z.string().trim().min(1).max(200))
    .max(200)
    .optional(),
  inputFieldDescriptions: z.record(z.string(), z.unknown()).optional(),
  defaultInput: z.record(z.string(), z.unknown()).optional(),
  pageLimitKey: z.string().trim().min(1).max(200).optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();
    const actors = await getAllActors(orgId);
    return NextResponse.json({ data: actors });
  } catch (err) {
    console.error("[lead-finder/actors] GET error", err);
    return NextResponse.json(
      { error: "Failed to list actors" },
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
    const {
      actorId,
      name,
      phase,
      description,
      requiredInputFields,
      inputFieldDescriptions,
      defaultInput,
      pageLimitKey,
    } = parsed.data;

    const insertData: Record<string, unknown> = {
      organization_id: orgId,
      actor_id: actorId,
      name,
      phase,
      description: description ?? null,
      required_input_fields: requiredInputFields ?? [],
      input_field_descriptions: inputFieldDescriptions ?? {},
      default_input: defaultInput ?? {},
      page_limit_key: pageLimitKey ?? null,
      is_enabled: true,
    };
    const { data: actor, error } = await supabase
      .from("lf_custom_actors")
      .insert(insertData as never)
      .select()
      .single();

    if (error) {
      console.error("[lead-finder/actors] insert error", error);
      return NextResponse.json(
        { error: "Failed to create actor" },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: actor }, { status: 201 });
  } catch (err) {
    console.error("[lead-finder/actors] POST error", err);
    return NextResponse.json(
      { error: "Failed to create actor" },
      { status: 500 }
    );
  }
}
