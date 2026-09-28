import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { isUuid } from "@/lib/security";

const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5_000).nullish(),
    phase: z.enum(["find", "enrich"]).optional(),
    required_input_fields: z
      .array(z.string().trim().min(1).max(200))
      .max(200)
      .optional(),
    input_field_descriptions: z.record(z.string(), z.unknown()).optional(),
    default_input: z.record(z.string(), z.unknown()).optional(),
    page_limit_key: z.string().trim().min(1).max(200).nullish(),
    is_enabled: z.boolean().optional(),
  })
  .strict();

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

    const orgId = await getOrgId();

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

    const updates = parsed.data as Record<string, unknown>;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: actor, error } = await supabase
      .from("lf_custom_actors")
      .update(updates as never)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) {
      console.error("[lead-finder/actors/:id] update error", error);
      return NextResponse.json(
        { error: "Failed to update actor" },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: actor });
  } catch (err) {
    console.error("[lead-finder/actors/:id] PUT error", err);
    return NextResponse.json(
      { error: "Failed to update actor" },
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

    const orgId = await getOrgId();

    const { error } = await supabase
      .from("lf_custom_actors")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      console.error("[lead-finder/actors/:id] delete error", error);
      return NextResponse.json(
        { error: "Failed to delete actor" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[lead-finder/actors/:id] DELETE error", err);
    return NextResponse.json(
      { error: "Failed to delete actor" },
      { status: 500 }
    );
  }
}
