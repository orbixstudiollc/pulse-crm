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
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 250);
  const offset = Number(searchParams.get("offset") || "0");

  try {
    const supabase = createAdminClient();

    const query = supabase
      .from("customers")
      .select(
        "id, first_name, last_name, email, company, status, health_score, mrr, lifetime_value, plan, created_at",
        { count: "exact" }
      )
      .eq("organization_id", auth.orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Math.max(limit - 1, 0));

    const { data, count, error } = status
      ? await query.eq("status", status as "active" | "pending" | "inactive")
      : await query;

    if (error) {
      return NextResponse.json(
        { error: "Unable to fetch customers" },
        { status: 500, headers: corsHeaders }
      );
    }

    const customers = (data ?? []).map((c) => ({
      ...c,
      name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      company_name: c.company,
    }));

    return NextResponse.json(
      { customers, total: count ?? 0 },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
