import { NextRequest, NextResponse } from "next/server";
import { authenticatePublicRequest, corsHeaders } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 250);
  const offset = Number(searchParams.get("offset") || "0");

  try {
    const supabase = createAdminClient();

    const { data, count, error } = await supabase
      .from("contacts")
      .select(
        "id, name, title, email, phone, lead_id, customer_id, buying_role, influence_level, created_at",
        { count: "exact" }
      )
      .eq("organization_id", auth.orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Math.max(limit - 1, 0));

    if (error) {
      return NextResponse.json(
        { error: "Unable to fetch contacts" },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { contacts: data ?? [], total: count ?? 0 },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
