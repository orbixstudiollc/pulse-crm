import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/security";

/**
 * GET /api/marketing/report/[id]
 * Returns the markdown report content for download.
 *
 * AuthZ: requires an authenticated Supabase session; RLS policy on
 * `marketing_reports` then enforces that the row belongs to the caller's org.
 * We still call `getUser()` explicitly to produce a clean 401 for callers
 * without a session.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: report, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("marketing_reports" as any)
    .select("*")
    .eq("id", id)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = report as any;
  if (r.report_type === "markdown" && r.content) {
    const safeTitle = String(r.title ?? "report").replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
    return new NextResponse(r.content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}.md"`,
      },
    });
  }

  return NextResponse.json(
    { error: "Report content not available" },
    { status: 404 }
  );
}
