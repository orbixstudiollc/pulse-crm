import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/marketing/report/[id]
 * Returns the markdown report content for download.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("marketing_reports" as any)
    .select("*")
    .eq("id", id)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const r = report as any;
  if (r.report_type === "markdown" && r.content) {
    // Return as downloadable markdown file
    const filename = `${r.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    return new NextResponse(r.content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Report content not available" }, { status: 404 });
}
