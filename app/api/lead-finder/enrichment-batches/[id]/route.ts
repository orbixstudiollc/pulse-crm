import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { isUuid } from "@/lib/security";
import { leadEmitter } from "@/lib/lead-finder/events/emitter";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireOrgAndBatch(
  batchId: string
): Promise<
  | {
      orgId: string;
      batch: {
        id: string;
        organization_id: string;
        campaign_id: string | null;
        label: string | null;
        status: string;
        total: number;
        created_at: string;
        started_at: string | null;
        finished_at: string | null;
      };
    }
  | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isUuid(batchId)) {
    return NextResponse.json({ error: "Invalid batch ID" }, { status: 400 });
  }

  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const { data: batch, error } = await supabase
    .from("lf_enrichment_batches")
    .select(
      "id, organization_id, campaign_id, label, status, total, created_at, started_at, finished_at"
    )
    .eq("id", batchId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error || !batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return { orgId, batch };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const resolved = await requireOrgAndBatch(id);
  if (resolved instanceof NextResponse) return resolved;
  const { orgId, batch } = resolved;

  // Count jobs by status in one pass — RLS-scoped supabase client still
  // respects organization_id on the batch query above, and we include
  // organization_id here for defence in depth.
  const supabase = await createClient();
  const { data: jobs, error: jobsErr } = await supabase
    .from("lf_enrichment_jobs")
    .select("status")
    .eq("batch_id", batch.id)
    .eq("organization_id", orgId);

  if (jobsErr) {
    return NextResponse.json(
      { error: "Failed to load jobs" },
      { status: 500 }
    );
  }

  const byStatus: Record<string, number> = {};
  for (const row of jobs ?? []) {
    const k = (row.status as string) ?? "unknown";
    byStatus[k] = (byStatus[k] ?? 0) + 1;
  }

  const done = byStatus["done"] ?? 0;
  const failed = byStatus["failed"] ?? 0;
  const running = byStatus["running"] ?? 0;
  const queued = (byStatus["queued"] ?? 0) + (byStatus["retry"] ?? 0);
  const total = batch.total;

  let etaSeconds: number | null = null;
  if (batch.started_at && done > 0 && queued + running > 0) {
    const elapsedMs = Date.now() - new Date(batch.started_at).getTime();
    if (elapsedMs > 0) {
      const ratePerMs = done / elapsedMs;
      if (ratePerMs > 0) {
        const remaining = queued + running;
        etaSeconds = Math.round(remaining / ratePerMs / 1000);
      }
    }
  }

  return NextResponse.json({
    id: batch.id,
    campaignId: batch.campaign_id,
    label: batch.label,
    status: batch.status,
    total,
    done,
    failed,
    running,
    queued,
    etaSeconds,
    createdAt: batch.created_at,
    startedAt: batch.started_at,
    finishedAt: batch.finished_at,
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const resolved = await requireOrgAndBatch(id);
  if (resolved instanceof NextResponse) return resolved;
  const { orgId, batch } = resolved;

  // Admin client for the job-mass-cancel update — worker also uses admin,
  // and we still enforce organization_id explicitly.
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { error: cancelErr } = await admin
    .from("lf_enrichment_jobs")
    .update({ status: "cancelled", finished_at: nowIso })
    .eq("batch_id", batch.id)
    .eq("organization_id", orgId)
    .in("status", ["queued", "retry"]);

  if (cancelErr) {
    return NextResponse.json(
      { error: "Failed to cancel jobs" },
      { status: 500 }
    );
  }

  const { error: batchErr } = await admin
    .from("lf_enrichment_batches")
    .update({ status: "cancelled", finished_at: nowIso })
    .eq("id", batch.id)
    .eq("organization_id", orgId);

  if (batchErr) {
    return NextResponse.json(
      { error: "Failed to cancel batch" },
      { status: 500 }
    );
  }

  // Notify listeners so dashboards can react without polling
  const { data: fresh } = await admin
    .from("lf_enrichment_jobs")
    .select("status")
    .eq("batch_id", batch.id)
    .eq("organization_id", orgId);

  const freshCounts: Record<string, number> = {};
  for (const r of fresh ?? []) {
    const k = (r.status as string) ?? "unknown";
    freshCounts[k] = (freshCounts[k] ?? 0) + 1;
  }

  leadEmitter.emit("enrichment-batch:updated", {
    batchId: batch.id,
    organizationId: orgId,
    campaignId: batch.campaign_id,
    total: batch.total,
    completed: freshCounts["done"] ?? 0,
    failed: freshCounts["failed"] ?? 0,
    status: "cancelled",
  });

  return NextResponse.json({ ok: true });
}
