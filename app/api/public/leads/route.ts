import { NextRequest, NextResponse } from "next/server";
import { authenticatePublicRequest, corsHeaders } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { pickSortColumn } from "@/lib/security";

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 250);
  const offset = Number(searchParams.get("offset") || "0");
  const sortColumn = pickSortColumn(
    searchParams.get("sort"),
    [
      "score",
      "created_at",
      "name",
      "win_probability",
      "icp_match_score",
      "last_contacted_at",
    ] as const,
    "created_at"
  );

  try {
    const supabase = createAdminClient();

    const query = supabase
      .from("leads")
      .select(
        "id, name, email, company, status, score, icp_match_score, qualification_grade, qualification_score, win_probability, source, last_contacted_at, next_followup, created_at, tags",
        { count: "exact" }
      )
      .eq("organization_id", auth.orgId)
      .order(sortColumn, { ascending: false })
      .range(offset, offset + Math.max(limit - 1, 0));

    const { data, count, error } = status
      ? await query.eq("status", status as "hot" | "warm" | "cold")
      : await query;

    if (error) {
      return NextResponse.json(
        { error: "Unable to fetch leads" },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { leads: data ?? [], total: count ?? 0 },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
