import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();
    const campaignId = req.nextUrl.searchParams.get("campaignId");
    const status = req.nextUrl.searchParams.get("status");

    let query = supabase
      .from("lf_leads")
      .select(
        "id, display_name, email, phone, website, status, score, source, created_at, mapped_data, llm_cost_usd, apify_cost_usd"
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (campaignId) query = query.eq("campaign_id", campaignId);
    if (status) query = query.eq("status", status);

    const { data: leads, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allLeads = leads ?? [];

    // Build CSV
    const headers = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "Website",
      "Status",
      "Score",
      "Source",
      "Created At",
      "LLM Cost ($)",
      "Apify Cost ($)",
    ];

    const rows = allLeads.map((lead) => [
      lead.id,
      csvEscape(lead.display_name ?? ""),
      csvEscape(lead.email ?? ""),
      csvEscape(lead.phone ?? ""),
      csvEscape(lead.website ?? ""),
      lead.status,
      String(lead.score ?? 0),
      csvEscape(lead.source ?? ""),
      lead.created_at,
      String(lead.llm_cost_usd ?? 0),
      String(lead.apify_cost_usd ?? 0),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lead-finder-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
