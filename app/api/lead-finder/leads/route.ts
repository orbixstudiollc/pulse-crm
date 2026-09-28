import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { isUuid, pickSortColumn } from "@/lib/security";

const LF_LEAD_SORTABLE = [
  "created_at",
  "updated_at",
  "score",
  "display_name",
  "status",
  "llm_cost_usd",
] as const;

// Mirrors the CHECK constraint on lf_leads.status in
// supabase/migrations/025_lead_finder.sql
const LeadStatusEnum = z.enum([
  "new",
  "enriching",
  "qualified",
  "converted",
  "declined",
  "archived",
]);

const ListQuerySchema = z.object({
  campaignId: z
    .string()
    .uuid("campaignId must be a UUID")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  status: LeadStatusEnum.optional().or(
    z.literal("").transform(() => undefined)
  ),
  limit: z.coerce.number().int().min(1).max(1_000).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
  sortBy: z.string().max(64).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = await getOrgId();

    const queryParsed = ListQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams.entries())
    );
    if (!queryParsed.success) {
      return NextResponse.json(
        { error: queryParsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 }
      );
    }
    const q = queryParsed.data;
    const campaignId = q.campaignId ?? null;
    const status = q.status ?? null;
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 250);
    const offset = q.offset ?? 0;
    const sortBy = pickSortColumn(
      q.sortBy,
      LF_LEAD_SORTABLE,
      "created_at"
    );
    const sortDir = q.sortDir === "asc";

    if (campaignId && !isUuid(campaignId)) {
      return NextResponse.json(
        { error: "campaignId must be a UUID" },
        { status: 400 }
      );
    }

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
      console.error("[lead-finder/leads] list error", error);
      return NextResponse.json(
        { error: "Unable to fetch leads" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: leads, total: count ?? 0 });
  } catch (err) {
    console.error("[lead-finder/leads] unexpected", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const createLeadSchema = z.object({
  action: z.literal("create").optional(),
  campaignId: z.string().uuid().nullish(),
  source: z.string().trim().max(64).optional(),
  displayName: z.string().trim().max(256).nullish(),
  display_name: z.string().trim().max(256).nullish(),
  email: z.string().trim().email().max(320).nullish(),
  phone: z.string().trim().max(64).nullish(),
  website: z.string().trim().url().max(2048).nullish(),
  status: LeadStatusEnum.optional(),
  rawData: z.record(z.string(), z.unknown()).optional(),
  raw_data: z.record(z.string(), z.unknown()).optional(),
  mappedData: z.record(z.string(), z.unknown()).optional(),
  mapped_data: z.record(z.string(), z.unknown()).optional(),
});

const importSchema = z.object({
  action: z.literal("import"),
  leadIds: z.array(z.string().uuid()).min(1).max(10_000),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = await getOrgId();

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Handle bulk import to CRM
    if ((rawBody as Record<string, unknown>).action === "import") {
      const importParsed = importSchema.safeParse(rawBody);
      if (!importParsed.success) {
        return NextResponse.json(
          {
            error:
              importParsed.error.issues[0]?.message ?? "Invalid import payload",
          },
          { status: 400 }
        );
      }
      const body = importParsed.data;
      const leadIds = body.leadIds;

      // Fetch the leads to import
      const { data: lfLeads, error: fetchErr } = await supabase
        .from("lf_leads")
        .select("*")
        .in("id", leadIds)
        .eq("organization_id", orgId);

      if (fetchErr) {
        console.error("[lead-finder/leads] fetch for import", fetchErr);
        return NextResponse.json(
          { error: "Unable to fetch leads" },
          { status: 500 }
        );
      }
      if (!lfLeads || lfLeads.length === 0) {
        return NextResponse.json(
          { error: "No matching leads found" },
          { status: 404 }
        );
      }

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

    const createParsed = createLeadSchema.safeParse(rawBody);
    if (!createParsed.success) {
      return NextResponse.json(
        {
          error: createParsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        { status: 400 }
      );
    }
    const body = createParsed.data;
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
      console.error("[lead-finder/leads] insert error", error);
      return NextResponse.json(
        { error: "Unable to create lead" },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (err) {
    console.error("[lead-finder/leads] post unexpected", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
