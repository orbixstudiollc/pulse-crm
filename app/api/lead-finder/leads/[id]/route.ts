import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { isUuid } from "@/lib/security";

const LeadStatusEnum = z.enum([
  "new",
  "enriching",
  "qualified",
  "converted",
  "declined",
  "archived",
]);

// `campaignKpis` is a free-form map of user-defined KPI keys to boolean/text
// answers. Mirrors lead-finder's `campaignKpisSchema`.
const campaignKpisSchema = z.record(
  z.string().trim().min(1).max(200),
  z.union([z.string().max(5_000), z.boolean()])
);

const UpdateSchema = z
  .object({
    display_name: z.string().trim().max(256).nullish(),
    email: z.string().trim().email().max(320).nullish(),
    phone: z.string().trim().max(64).nullish(),
    website: z.string().trim().url().max(2048).nullish(),
    status: LeadStatusEnum.optional(),
    score: z.number().int().min(0).max(100).optional(),
    mapped_data: z.record(z.string(), z.unknown()).optional(),
    imported: z.boolean().optional(),
    imported_lead_id: z.string().uuid().nullish(),
    campaignKpis: campaignKpisSchema.optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();

    // Fetch lead
    const { data: lead, error } = await supabase
      .from("lf_leads")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (error || !lead) {
      if (error) console.error("[lead-finder/leads/:id] fetch error", error);
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Fetch personalization. RLS on lf_lead_personalization scopes by
    // lead_id -> lf_leads.organization_id, and we already verified the parent
    // lead belongs to this org above, so this is safe under RLS.
    const { data: personalization } = await supabase
      .from("lf_lead_personalization")
      .select("*")
      .eq("lead_id", id)
      .maybeSingle();

    return NextResponse.json({
      data: { ...lead, personalization: personalization ?? null },
    });
  } catch (err) {
    console.error("[lead-finder/leads/:id] GET error", err);
    return NextResponse.json(
      { error: "Failed to load lead" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { campaignKpis, ...rest } = parsed.data;
    const updates = rest as Record<string, unknown>;

    if (campaignKpis === undefined && Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Verify lead belongs to this org before touching personalization
    // (defence-in-depth on top of RLS on lf_lead_personalization).
    const { data: ownedLead, error: ownedErr } = await supabase
      .from("lf_leads")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (ownedErr || !ownedLead) {
      if (ownedErr)
        console.error(
          "[lead-finder/leads/:id] ownership check failed",
          ownedErr
        );
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (campaignKpis !== undefined) {
      const { data: existingRows, error: existingErr } = await supabase
        .from("lf_lead_personalization")
        .select("id")
        .eq("lead_id", id)
        .limit(1);
      if (existingErr) {
        console.error(
          "[lead-finder/leads/:id] personalization lookup failed",
          existingErr
        );
        return NextResponse.json(
          { error: "Failed to update lead" },
          { status: 500 }
        );
      }

      const existing = existingRows?.[0] ?? null;
      if (existing) {
        const { error: updErr } = await supabase
          .from("lf_lead_personalization")
          .update({ campaign_kpis: campaignKpis } as never)
          .eq("id", existing.id);
        if (updErr) {
          console.error(
            "[lead-finder/leads/:id] personalization update failed",
            updErr
          );
          return NextResponse.json(
            { error: "Failed to update lead" },
            { status: 500 }
          );
        }
      } else {
        const { error: insErr } = await supabase
          .from("lf_lead_personalization")
          .insert({ lead_id: id, campaign_kpis: campaignKpis } as never);
        if (insErr) {
          console.error(
            "[lead-finder/leads/:id] personalization insert failed",
            insErr
          );
          return NextResponse.json(
            { error: "Failed to update lead" },
            { status: 500 }
          );
        }
      }
    }

    let updatedLead: unknown = null;
    if (Object.keys(updates).length > 0) {
      const { data: lead, error } = await supabase
        .from("lf_leads")
        .update(updates as never)
        .eq("id", id)
        .eq("organization_id", orgId)
        .select()
        .single();

      if (error) {
        console.error("[lead-finder/leads/:id] update error", error);
        return NextResponse.json(
          { error: "Failed to update lead" },
          { status: 400 }
        );
      }
      updatedLead = lead;
    } else {
      const { data: lead } = await supabase
        .from("lf_leads")
        .select("*")
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();
      updatedLead = lead;
    }

    return NextResponse.json({ data: updatedLead });
  } catch (err) {
    console.error("[lead-finder/leads/:id] PUT error", err);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}
