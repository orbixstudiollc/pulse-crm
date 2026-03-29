import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { actorId } = body as { actorId: string };

    if (!actorId) {
      return NextResponse.json(
        { error: "actorId is required" },
        { status: 400 }
      );
    }

    // Validate via Apify public API
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      return NextResponse.json(
        { error: "APIFY_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    const actorUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}?token=${apifyToken}`;
    const response = await fetch(actorUrl);

    if (!response.ok) {
      return NextResponse.json(
        {
          valid: false,
          error: `Actor "${actorId}" not found or inaccessible`,
        },
        { status: 200 }
      );
    }

    const actorData = await response.json();
    return NextResponse.json({
      valid: true,
      actor: {
        id: actorData.data?.id,
        name: actorData.data?.name,
        title: actorData.data?.title,
        description: actorData.data?.description,
        isPublic: actorData.data?.isPublic,
        username: actorData.data?.username,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
