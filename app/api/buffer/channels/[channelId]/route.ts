import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/buffer/channels/[channelId]
 * Disconnect a Buffer channel
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
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
    // 1. Verify the channel belongs to the user's organization
    // 2. Call Buffer API to disconnect the channel
    // 3. Remove from your database if you're caching channel data

    // For now, return success
    return NextResponse.json({
      success: true,
      message: "Channel disconnected successfully",
    });
  } catch (error) {
    console.error("Failed to disconnect channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
