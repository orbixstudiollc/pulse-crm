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
const JOB_PAGE_SIZE = 1000;

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

  // One aggregated read instead of two head-count queries per batch. Paged
  // because PostgREST caps the rows returned per request.
  const batchIds = (rows ?? []).map((b) => b.id);
  const counts = new Map<string, { done: number; failed: number }>();
  for (let from = 0; batchIds.length > 0; from += JOB_PAGE_SIZE) {
    const { data: jobs, error: jobsError } = await supabase
      .from("lf_enrichment_jobs")
      .select("batch_id, status")
      .eq("organization_id", orgId)
      .in("batch_id", batchIds)
      .in("status", ["done", "failed"])
      .order("id", { ascending: true })
      .range(from, from + JOB_PAGE_SIZE - 1);
    if (jobsError) {
      return NextResponse.json(
        { error: "Failed to load enrichment jobs" },
        { status: 500 }
      );
    }
    for (const j of jobs ?? []) {
      const c = counts.get(j.batch_id) ?? { done: 0, failed: 0 };
      if (j.status === "done") c.done += 1;
      else c.failed += 1;
      counts.set(j.batch_id, c);
    }
    if ((jobs ?? []).length < JOB_PAGE_SIZE) break;
  }

  const batches = (rows ?? []).map((b) => ({
    id: b.id,
    campaignId: b.campaign_id,
    total: b.total,
    done: counts.get(b.id)?.done ?? 0,
    failed: counts.get(b.id)?.failed ?? 0,
    status: b.status,
  }));

  return NextResponse.json({
    active: batches.some((b) => ACTIVE_STATUSES.includes(b.status)),
    batches,
  });
}
