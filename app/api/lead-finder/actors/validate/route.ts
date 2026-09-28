import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveApifyCredential } from "@/lib/lead-finder/apify/token";
import { evaluateActorPolicy } from "@/lib/lead-finder/apify/policy";

const validateSchema = z.object({
  actorId: z
    .string()
    .min(1)
    .max(128)
    // Apify actors look like `username/actor-name` or a bare id
    .regex(/^[a-zA-Z0-9._\-/~]+$/, "Invalid actor id"),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let parsed: z.infer<typeof validateSchema>;
    try {
      parsed = validateSchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    if (!profile?.organization_id) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const cred = await resolveApifyCredential(profile.organization_id);
    if (!cred) {
      return NextResponse.json(
        { error: "Apify token not configured" },
        { status: 503 }
      );
    }

    const policy = evaluateActorPolicy([parsed.actorId], cred.source);
    if (!policy.allowed) {
      return NextResponse.json(
        { error: "Custom actors require your own Apify API key" },
        { status: 403 }
      );
    }

    // SECURITY: pass the token via Authorization header so it doesn't leak
    // into access logs, APM traces, or Referer.
    const actorUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(parsed.actorId)}`;
    const response = await fetch(actorUrl, {
      headers: { Authorization: `Bearer ${cred.token}` },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          valid: false,
          error: `Actor "${parsed.actorId}" not found or inaccessible`,
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
    console.error("[lead-finder/actors/validate] error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
