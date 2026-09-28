import { NextRequest, NextResponse } from "next/server";
import { authenticatePublicRequest, corsHeaders } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();

    const [
      leadsResult,
      customersResult,
      dealsResult,
      contactsResult,
      proposalsResult,
      activitiesResult,
    ] = await Promise.all([
      supabase
        .from("leads")
        .select("id, status", { count: "exact" })
        .eq("organization_id", auth.orgId),
      supabase
        .from("customers")
        .select("id, status", { count: "exact" })
        .eq("organization_id", auth.orgId),
      supabase
        .from("deals")
        .select("id, stage, value", { count: "exact" })
        .eq("organization_id", auth.orgId),
      supabase
        .from("contacts")
        .select("id", { count: "exact" })
        .eq("organization_id", auth.orgId),
      supabase
        .from("proposals")
        .select("id", { count: "exact" })
        .eq("organization_id", auth.orgId),
      supabase
        .from("activities")
        .select(
          "id, type, title, description, related_type, related_id, created_at"
        )
        .eq("organization_id", auth.orgId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const leads = leadsResult.data ?? [];
    const leadsByStatus: Record<string, number> = {};
    for (const lead of leads) {
      const s = lead.status ?? "unknown";
      leadsByStatus[s] = (leadsByStatus[s] || 0) + 1;
    }

    const customers = customersResult.data ?? [];
    const activeCustomers = customers.filter(
      (c) => c.status === "active"
    ).length;

    const deals = dealsResult.data ?? [];
    const dealsByStage: Record<string, number> = {};
    let totalPipelineValue = 0;
    for (const deal of deals) {
      const s = deal.stage ?? "unknown";
      dealsByStage[s] = (dealsByStage[s] || 0) + 1;
      totalPipelineValue += deal.value ?? 0;
    }

    const analytics = {
      total_leads: leadsResult.count ?? 0,
      leads_by_status: leadsByStatus,
      total_customers: customersResult.count ?? 0,
      active_customers: activeCustomers,
      total_deals: dealsResult.count ?? 0,
      deals_by_stage: dealsByStage,
      total_pipeline_value: totalPipelineValue,
      total_contacts: contactsResult.count ?? 0,
      total_proposals: proposalsResult.count ?? 0,
      recent_activities: activitiesResult.data ?? [],
    };

    return NextResponse.json(analytics, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
