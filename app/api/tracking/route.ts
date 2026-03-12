import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// CORS headers for cross-origin tracking script
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { script_key, session_id, page_url, page_title, referrer, duration } = body;

    if (!script_key || !page_url) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    const supabase = createAdminClient();

    // Validate script_key and get org
    const { data: script, error: scriptErr } = await supabase
      .from("tracking_scripts")
      .select("id, organization_id, is_active")
      .eq("script_key", script_key)
      .single();

    if (scriptErr || !script || !script.is_active) {
      return NextResponse.json({ error: "Invalid or inactive script" }, { status: 403, headers: corsHeaders });
    }

    // Get IP and basic geo (from headers)
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    // Find or create visitor by session_id + org
    const sid = session_id || `anon_${ip}_${Date.now()}`;

    const { data: existingVisitor } = await supabase
      .from("website_visitors")
      .select("id, visit_count, page_count, total_duration")
      .eq("organization_id", script.organization_id)
      .eq("session_id", sid)
      .single();

    let visitorId: string;

    if (existingVisitor) {
      // Update existing visitor
      visitorId = existingVisitor.id;
      await supabase
        .from("website_visitors")
        .update({
          last_seen: new Date().toISOString(),
          visit_count: existingVisitor.visit_count + 1,
          page_count: existingVisitor.page_count + 1,
          total_duration: existingVisitor.total_duration + (duration || 0),
          status: existingVisitor.visit_count >= 3 ? "hot" : "returning",
        })
        .eq("id", existingVisitor.id);
    } else {
      // Create new visitor
      const { data: newVisitor, error: insertErr } = await supabase
        .from("website_visitors")
        .insert({
          organization_id: script.organization_id,
          script_id: script.id,
          session_id: sid,
          ip_address: ip,
          page_count: 1,
          status: "new",
        })
        .select("id")
        .single();

      if (insertErr || !newVisitor) {
        return NextResponse.json({ error: "Failed to create visitor" }, { status: 500, headers: corsHeaders });
      }
      visitorId = newVisitor.id;
    }

    // Record the page visit
    await supabase.from("website_visits").insert({
      visitor_id: visitorId,
      organization_id: script.organization_id,
      page_url,
      page_title: page_title || null,
      referrer: referrer || null,
      duration: duration || 0,
      user_agent: userAgent,
    });

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("Tracking error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: corsHeaders });
  }
}
