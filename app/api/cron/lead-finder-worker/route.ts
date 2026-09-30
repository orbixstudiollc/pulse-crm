/**
 * Lead Finder worker pump cron.
 *
 * GET /api/cron/lead-finder-worker
 *
 * Drains a bounded, awaited batch of enrichment jobs and returns the counts.
 * All work finishes before the response, so nothing depends on the instance
 * staying warm; run it on a schedule (e.g. every minute) to keep the queue moving.
 *
 * Authenticated via the standard cron secret (shared by all cron endpoints).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/security";
import { drainEnrichmentJobs } from "@/lib/lead-finder/enrichment/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authErr = verifyCronRequest(req);
  if (authErr) return authErr;

  try {
    const result = await drainEnrichmentJobs({
      maxJobs: 50,
      deadlineMs: 240_000,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/lead-finder-worker] failed", err);
    return NextResponse.json(
      { ok: false, error: "Worker drain failed" },
      { status: 500 }
    );
  }
}
