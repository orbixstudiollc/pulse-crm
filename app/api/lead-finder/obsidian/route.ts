import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import {
  listObservationFiles,
  readObservationFile,
} from "@/lib/lead-finder/obsidian/observer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
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

  const date = req.nextUrl.searchParams.get("date");

  // If a date is requested, return the file contents (plain text). Otherwise
  // list available files in this org's vault.
  if (date !== null) {
    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format (expected YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    try {
      const body = await readObservationFile(orgId, date);
      if (body === null) {
        return NextResponse.json(
          { error: "Observation file not found" },
          { status: 404 }
        );
      }
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    } catch (err) {
      console.error("[obsidian] read failed", err);
      return NextResponse.json(
        { error: "Failed to read observation file" },
        { status: 500 }
      );
    }
  }

  try {
    const files = await listObservationFiles(orgId);
    return NextResponse.json({ files });
  } catch (err) {
    console.error("[obsidian] list failed", err);
    return NextResponse.json(
      { error: "Failed to list observation files" },
      { status: 500 }
    );
  }
}
