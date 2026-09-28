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
  const type = searchParams.get("type");
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 100);
  const offset = Number(searchParams.get("offset") || "0");

  try {
    const supabase = createAdminClient();

    const query = supabase
      .from("activities")
      .select(
        "id, type, title, description, related_type, related_id, created_at",
        { count: "exact" }
      )
      .eq("organization_id", auth.orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Math.max(limit - 1, 0));

    const { data, count, error } = type
      ? await query.eq(
          "type",
          type as "call" | "meeting" | "task" | "email" | "note"
        )
      : await query;

    if (error) {
      return NextResponse.json(
        { error: "Unable to fetch activities" },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { activities: data ?? [], total: count ?? 0 },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
