import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { getAllActors } from "@/lib/lead-finder/apify/registry-server";

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
    return NextResponse.json({ error: String(err) }, { status: 500 });
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
    const body = await req.json();

    const {
      actorId,
      name,
      phase,
      description,
      requiredInputFields,
      inputFieldDescriptions,
      defaultInput,
      pageLimitKey,
    } = body as {
      actorId: string;
      name: string;
      phase: "find" | "enrich";
      description?: string;
      requiredInputFields?: string[];
      inputFieldDescriptions?: Record<string, unknown>;
      defaultInput?: Record<string, unknown>;
      pageLimitKey?: string;
    };

    if (!actorId || !name || !phase) {
      return NextResponse.json(
        { error: "actorId, name, and phase are required" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: actor }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
