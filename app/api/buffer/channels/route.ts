import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/buffer/channels
 * List all connected Buffer channels for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile with organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // In a real implementation, you would:
    // 1. Store Buffer organization_id in your database linked to your org
    // 2. Call Buffer API with stored credentials
    // 3. Return the channels

    // For now, return mock data structure
    // Replace this with actual Buffer MCP call when credentials are stored
    return NextResponse.json({
      channels: [],
      message: "Buffer integration not yet configured for this organization"
    });
  } catch (error) {
    console.error("Failed to fetch channels:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
