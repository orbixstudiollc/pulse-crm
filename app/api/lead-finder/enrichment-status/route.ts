/**
 * GET /api/lead-finder/enrichment-status
 *
 * Polled by EnrichmentProgressBanner. Returns the caller's organization's
 * enrichment batches that are still in progress plus those that finished in
 * the last two minutes, with per-batch done/failed job counts. Reads go
 * through the user-scoped client (RLS) with an explicit organization filter.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENTLY_FINISHED_MS = 2 * 60_000;
const ACTIVE_STATUSES = ["queued", "running", "paused"];

export async function GET() {
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

  const finishedSince = new Date(
    Date.now() - RECENTLY_FINISHED_MS
  ).toISOString();

  const { data: rows, error } = await supabase
    .from("lf_enrichment_batches")
    .select("id, campaign_id, total, status")
    .eq("organization_id", orgId)
    .or(
      `status.in.(${ACTIVE_STATUSES.join(",")}),finished_at.gte.${finishedSince}`
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load enrichment batches" },
      { status: 500 }
    );
  }

  const countJobs = async (batchId: string, status: "done" | "failed") => {
    const { count } = await supabase
      .from("lf_enrichment_jobs")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .eq("organization_id", orgId)
      .eq("status", status);
    return count ?? 0;
  };

  const batches = await Promise.all(
    (rows ?? []).map(async (b) => {
      const [done, failed] = await Promise.all([
        countJobs(b.id, "done"),
        countJobs(b.id, "failed"),
      ]);
      return {
        id: b.id,
        campaignId: b.campaign_id,
        total: b.total,
        done,
        failed,
        status: b.status,
      };
    })
  );

  return NextResponse.json({
    active: batches.some((b) => ACTIVE_STATUSES.includes(b.status)),
    batches,
  });
}
