import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/buffer/connect
 * Generate OAuth URL for connecting a social account via Buffer
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform, profileId } = await request.json();

    if (!platform || !profileId) {
      return NextResponse.json(
        { error: "Platform and profileId are required" },
        { status: 400 }
      );
    }

    // Get user profile with organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", profileId)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Map platform IDs to Buffer service names
    const platformMap: Record<string, string> = {
      twitter: "twitter",
      instagram: "instagram",
      facebook: "facebook",
      linkedin: "linkedin",
      pinterest: "pinterest",
      tiktok: "tiktok",
      youtube: "youtube",
      threads: "threads",
      bluesky: "bluesky",
    };

    const bufferService = platformMap[platform];
    if (!bufferService) {
      return NextResponse.json(
        { error: "Unsupported platform" },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Get Buffer organization_id from your database
    // 2. Generate OAuth URL using Buffer's OAuth flow
    // 3. Store the pending connection state
    // 4. Return the OAuth URL

    // For development, return a placeholder URL
    // This should be replaced with actual Buffer OAuth implementation
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/api/buffer/callback`;
    const oauthUrl = `https://buffer.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&service=${bufferService}`;

    return NextResponse.json({
      url: oauthUrl,
      platform: bufferService,
    });
  } catch (error) {
    console.error("Failed to generate connect URL:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
