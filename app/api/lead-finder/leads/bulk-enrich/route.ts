import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { enqueueLeadsEnrichment } from "@/lib/lead-finder/enrichment/pipeline";

export const runtime = "nodejs";

const BodySchema = z.object({
  leadIds: z
    .array(z.string().uuid())
    .min(1, "leadIds must be a non-empty array of UUIDs")
    .max(10_000, "Max 10,000 leads per batch"),
  label: z.string().trim().min(1).max(200).optional(),
  campaignId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const result = await enqueueLeadsEnrichment(parsed.data.leadIds, orgId, {
      label: parsed.data.label,
      campaignId: parsed.data.campaignId ?? null,
    });

    return NextResponse.json({
      success: true,
      batchId: result.batchId,
      enqueued: result.enqueued,
      skipped: result.skipped,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bulk enrichment failed";
    // enqueueLeadsEnrichment throws when no leads resolved in this org — that's
    // a 404 from the caller's perspective; other failures are 500.
    const isNotFound =
      msg.includes("No leads matched") || msg.includes("No lead IDs");
    console.error("[lf/bulk-enrich]", err);
    return NextResponse.json(
      { error: isNotFound ? msg : "Bulk enrichment failed" },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
