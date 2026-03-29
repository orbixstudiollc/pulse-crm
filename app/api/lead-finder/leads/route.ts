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
    const { searchParams } = req.nextUrl;
    const campaignId = searchParams.get("campaignId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortDir = searchParams.get("sortDir") === "asc" ? true : false;

    let query = supabase
      .from("lf_leads")
      .select("*", { count: "exact" })
      .eq("organization_id", orgId)
      .order(sortBy, { ascending: sortDir })
      .range(offset, offset + limit - 1);

    if (campaignId) query = query.eq("campaign_id", campaignId);
    if (status) query = query.eq("status", status);

    const { data: leads, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: leads, total: count ?? 0 });
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

    // Handle bulk import to CRM
    if (body.action === "import" && Array.isArray(body.leadIds)) {
      const leadIds = body.leadIds as string[];
      if (leadIds.length === 0)
        return NextResponse.json({ error: "No leads specified" }, { status: 400 });

      // Fetch the leads to import
      const { data: lfLeads, error: fetchErr } = await supabase
        .from("lf_leads")
        .select("*")
        .in("id", leadIds)
        .eq("organization_id", orgId);

      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      if (!lfLeads || lfLeads.length === 0)
        return NextResponse.json({ error: "No matching leads found" }, { status: 404 });

      const imported: string[] = [];
      for (const lf of lfLeads) {
        if (lf.imported) continue; // skip already imported

        // Create a lead in the main CRM leads table
        const { data: crmLead, error: insertErr } = await supabase
          .from("leads")
          .insert({
            organization_id: orgId,
            name: lf.display_name || lf.email || "Unknown",
            email: lf.email,
            phone: lf.phone,
            website: lf.website,
            source: "lead-finder",
            status: "new",
            score: lf.score ?? 0,
          } as never)
          .select("id")
          .single();

        if (insertErr) continue; // skip on error, don't fail entire batch

        // Mark as imported
        await supabase
          .from("lf_leads")
          .update({ imported: true, imported_lead_id: crmLead.id })
          .eq("id", lf.id);

        imported.push(lf.id);
      }

      return NextResponse.json({
        data: { imported: imported.length, total: leadIds.length },
      });
    }

    const insertPayload = {
        organization_id: orgId,
        campaign_id: body.campaignId ?? null,
        source: body.source || "manual",
        display_name: body.displayName ?? body.display_name ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        website: body.website ?? null,
        status: body.status ?? "new",
        raw_data: body.rawData ?? body.raw_data ?? {},
        mapped_data: body.mappedData ?? body.mapped_data ?? {},
        score: 0,
        llm_cost_usd: 0,
        llm_input_tokens: 0,
        llm_output_tokens: 0,
        apify_cost_usd: 0,
        discovery_llm_cost_usd: 0,
        discovery_apify_cost_usd: 0,
        imported: false,
      };
    const { data: lead, error } = await supabase
      .from("lf_leads")
      .insert(insertPayload as never)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
