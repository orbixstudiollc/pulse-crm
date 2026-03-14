import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// CORS headers for cross-origin tracking script
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Lookup IP geolocation and org info via ip-api.com (free, no key needed)
async function enrichIP(ip: string): Promise<{
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  company_name?: string;
  company_domain?: string;
}> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return {};
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,org,reverse`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    if (data.status !== "success") return {};

    // Try to extract company name from org field (ISP/org name)
    let companyName = data.org || "";
    // Clean up common ISP prefixes
    companyName = companyName.replace(/^AS\d+\s+/, "");

    // Try to get domain from reverse DNS
    let companyDomain = "";
    if (data.reverse) {
      // Extract root domain from reverse DNS (e.g., "host.company.com" → "company.com")
      const parts = data.reverse.split(".");
      if (parts.length >= 2) {
        companyDomain = parts.slice(-2).join(".");
      }
    }

    return {
      city: data.city || undefined,
      region: data.regionName || undefined,
      country: data.country || undefined,
      country_code: data.countryCode || undefined,
      company_name: companyName || undefined,
      company_domain: companyDomain || undefined,
    };
  } catch {
    return {};
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { script_key, session_id, page_url, page_title, referrer, duration, scroll_depth } = body;

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

    // Get IP and user agent from headers
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    // Find or create visitor by session_id + org
    const sid = session_id || `anon_${ip}_${Date.now()}`;

    const { data: existingVisitor } = await supabase
      .from("website_visitors")
      .select("id, visit_count, page_count, total_duration, city")
      .eq("organization_id", script.organization_id)
      .eq("session_id", sid)
      .single();

    let visitorId: string;

    if (existingVisitor) {
      // Update existing visitor
      visitorId = existingVisitor.id;
      const updateData: Record<string, unknown> = {
        last_seen: new Date().toISOString(),
        visit_count: existingVisitor.visit_count + 1,
        page_count: existingVisitor.page_count + 1,
        total_duration: existingVisitor.total_duration + (duration || 0),
        status: existingVisitor.visit_count >= 3 || (scroll_depth && scroll_depth > 75) ? "hot" : "returning",
      };

      // Enrich with geo/company data if not already done
      if (!existingVisitor.city) {
        const enrichment = await enrichIP(ip);
        if (enrichment.city) updateData.city = enrichment.city;
        if (enrichment.region) updateData.region = enrichment.region;
        if (enrichment.country) updateData.country = enrichment.country;
        if (enrichment.country_code) updateData.country_code = enrichment.country_code;
        if (enrichment.company_name) updateData.company_name = enrichment.company_name;
        if (enrichment.company_domain) updateData.company_domain = enrichment.company_domain;
      }

      await supabase
        .from("website_visitors")
        .update(updateData)
        .eq("id", existingVisitor.id);
    } else {
      // Enrich new visitor with IP geolocation & company info
      const enrichment = await enrichIP(ip);

      const { data: newVisitor, error: insertErr } = await supabase
        .from("website_visitors")
        .insert({
          organization_id: script.organization_id,
          script_id: script.id,
          session_id: sid,
          ip_address: ip,
          page_count: 1,
          status: "new",
          city: enrichment.city || null,
          region: enrichment.region || null,
          country: enrichment.country || null,
          country_code: enrichment.country_code || null,
          company_name: enrichment.company_name || null,
          company_domain: enrichment.company_domain || null,
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
