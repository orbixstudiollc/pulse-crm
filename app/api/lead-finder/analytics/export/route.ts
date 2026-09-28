import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";

const LeadStatusEnum = z.enum([
  "new",
  "enriching",
  "qualified",
  "converted",
  "declined",
  "archived",
]);

const QuerySchema = z.object({
  format: z
    .enum(["json", "csv"])
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((v) => v ?? "csv"),
  campaignId: z
    .string()
    .uuid("campaignId must be a UUID")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  status: LeadStatusEnum.optional().or(
    z.literal("").transform(() => undefined)
  ),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();

    const parsed = QuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 }
      );
    }
    const { format, campaignId, status } = parsed.data;

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
      console.error("[analytics/export] supabase error", error);
      return NextResponse.json(
        { error: "Failed to export leads" },
        { status: 500 }
      );
    }

    const allLeads = leads ?? [];
    const dateSuffix = new Date().toISOString().split("T")[0];

    if (format === "json") {
      return new NextResponse(JSON.stringify(allLeads, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="lead-finder-export-${dateSuffix}.json"`,
        },
      });
    }

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
        "Content-Disposition": `attachment; filename="lead-finder-export-${dateSuffix}.csv"`,
      },
    });
  } catch (err) {
    console.error("[analytics/export] unhandled error", err);
    return NextResponse.json(
      { error: "Failed to export leads" },
      { status: 500 }
    );
  }
}

// SECURITY (CSV formula injection): cells beginning with any of
// `= + - @ \t \r` can be interpreted as formulas by Excel / LibreOffice and
// may exfiltrate data or execute commands. Prefix such cells with a single
// quote neutralizer and still apply RFC 4180 quoting when needed.
const CSV_FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

function csvEscape(value: string): string {
  let v = value ?? "";
  if (v.length > 0 && CSV_FORMULA_TRIGGERS.has(v[0]!)) {
    v = "'" + v;
  }
  if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
