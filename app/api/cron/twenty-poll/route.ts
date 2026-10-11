import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronRequest } from "@/lib/security";
import { runTwentyPolling } from "@/lib/twenty/workflows/poller";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  const error = verifyCronRequest(request);
  if (error) return error;
  try { return NextResponse.json(await runTwentyPolling(createAdminClient())); }
  catch { return NextResponse.json({ error: "Twenty polling failed" }, { status: 500 }); }
}
