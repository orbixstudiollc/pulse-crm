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
  const stageRaw = searchParams.get("stage");
  const ALLOWED_STAGES = [
    "discovery",
    "proposal",
    "negotiation",
    "closed_won",
    "closed_lost",
  ] as const;
  type Stage = (typeof ALLOWED_STAGES)[number];
  const stage: Stage | null = (ALLOWED_STAGES as readonly string[]).includes(
    stageRaw ?? ""
  )
    ? (stageRaw as Stage)
    : null;
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 250);
  const offset = Number(searchParams.get("offset") || "0");

  try {
    const supabase = createAdminClient();

    const query = supabase
      .from("deals")
      .select(
        "id, name, value, stage, probability, contact_name, contact_email, close_date, created_at",
        { count: "exact" }
      )
      .eq("organization_id", auth.orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Math.max(limit - 1, 0));

    const { data, count, error } = stage
      ? await query.eq("stage", stage)
      : await query;

    if (error) {
      return NextResponse.json(
        { error: "Unable to fetch deals" },
        { status: 500, headers: corsHeaders }
      );
    }

    const deals = (data ?? []).map((d) => ({
      ...d,
      expected_close_date: d.close_date,
    }));

    return NextResponse.json(
      { deals, total: count ?? 0 },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
