import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();

    // Fetch lead
    const { data: lead, error } = await supabase
      .from("lf_leads")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { error: error?.message ?? "Lead not found" },
        { status: 404 }
      );
    }

    // Fetch personalization data if exists
    const { data: personalization } = await supabase
      .from("lf_lead_personalization")
      .select("*")
      .eq("lead_id", id)
      .single();

    return NextResponse.json({
      data: { ...lead, personalization: personalization ?? null },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();
    const body = await req.json();

    // Build update payload from allowed fields
    const allowedFields = [
      "display_name",
      "email",
      "phone",
      "website",
      "status",
      "score",
      "mapped_data",
      "imported",
      "imported_lead_id",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: lead, error } = await supabase
      .from("lf_leads")
      .update(updates as never)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: lead });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
