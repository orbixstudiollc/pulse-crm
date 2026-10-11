import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronRequest } from "@/lib/security";
import { runTwentyJobs } from "@/lib/twenty/workflows/worker";

export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(request: Request) {
  const error = verifyCronRequest(request);
  if (error) return error;
  try { return NextResponse.json(await runTwentyJobs(createAdminClient())); }
  catch { return NextResponse.json({ error: "Twenty worker failed" }, { status: 500 }); }
}
