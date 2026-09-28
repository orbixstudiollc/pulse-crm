/**
 * Lead Finder worker pump cron.
 *
 * GET /api/cron/lead-finder-worker
 *
 * Kicks the durable enrichment worker. The worker itself is HMR-safe and an
 * idempotent singleton, so calling it on a cron schedule (every minute on
 * Vercel) keeps job draining alive across cold-starts / process restarts.
 *
 * Authenticated via the standard cron secret (shared by all cron endpoints).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/security";
import { workerPump } from "@/lib/lead-finder/enrichment/worker";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authErr = verifyCronRequest(req);
  if (authErr) return authErr;

  try {
    workerPump();
    return NextResponse.json({ ok: true, pumped: true });
  } catch (err) {
    console.error("[cron/lead-finder-worker] failed", err);
    return NextResponse.json(
      { ok: false, error: "Worker pump failed" },
      { status: 500 }
    );
  }
}
