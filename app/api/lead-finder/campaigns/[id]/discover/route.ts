import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { isUuid } from "@/lib/security";
import { startDiscoveryRun } from "@/lib/lead-finder/apify/discovery";
import { authorizeActors } from "@/lib/lead-finder/apify/policy-server";
import { ApifyError } from "@/lib/lead-finder/apify/runner";

// Starting an Apify run is a single HTTP call; the cron route finalises it.
export const maxDuration = 60;

const BodySchema = z
  .object({
    actorId: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9._\-/~]+$/, "Invalid actorId")
      .optional(),
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();

    const { data: campRows } = await supabase
      .from("lf_campaigns")
      .select("status, apify_actors, actor_configs, max_pages_per_search")
      .eq("id", id)
      .eq("organization_id", orgId)
      .limit(1);
    const campaign = campRows?.[0] ?? null;

    if (!campaign)
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (campaign.status !== "active")
      return NextResponse.json(
        { error: "Campaign must be active" },
        { status: 400 }
      );

    const actors = (campaign.apify_actors as string[]) || [];
    if (actors.length === 0)
      return NextResponse.json({ error: "No actors configured" }, { status: 400 });

    // Body is optional — if present, must be a JSON object matching BodySchema.
    let actorId: string | undefined;
    const contentLength = req.headers.get("content-length");
    const hasBody =
      contentLength !== null && contentLength !== "0" &&
      (req.headers.get("content-type") ?? "").includes("application/json");

    if (hasBody) {
      let rawBody: unknown;
      try {
        rawBody = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      // Allow empty object as "no actor id"
      if (rawBody !== null) {
        const parsed = BodySchema.safeParse(rawBody);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid request" },
            { status: 400 }
          );
        }
        actorId = parsed.data.actorId;
      }
    }

    if (actorId && !actors.includes(actorId)) {
      return NextResponse.json(
        { error: "Actor not in campaign" },
        { status: 400 }
      );
    }

    // Per-actor discovery when actorId is given, otherwise every campaign actor.
    const actorIds = actorId ? [actorId] : actors;

    // Resolves the Apify token and checks the actor policy.
    let token: string;
    try {
      token = (await authorizeActors(orgId, actorIds)).token;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Apify is not configured" },
        { status: 400 }
      );
    }

    const actorConfigs =
      (campaign.actor_configs as Record<string, Record<string, unknown>>) ||
      {};
    // The page limit applies to full-campaign discovery only, as before.
    const maxPages = actorId
      ? undefined
      : (campaign.max_pages_per_search as number | null) ?? undefined;

    const runIds: string[] = [];
    for (const aid of actorIds) {
      try {
        const { runId } = await startDiscoveryRun(
          {
            actorId: aid,
            input: actorConfigs[aid] ?? {},
            campaignId: id,
            orgId,
            token,
            maxPages,
          },
          supabase
        );
        runIds.push(runId);
      } catch (err) {
        console.error("[lead-finder/campaigns/:id/discover] start failed", err);
        if (err instanceof ApifyError) {
          return NextResponse.json(
            { error: err.message, runIds },
            { status: 502 }
          );
        }
        throw err;
      }
    }

    return NextResponse.json(
      { started: true, runId: runIds[0], runIds },
      { status: 202 }
    );
  } catch (err) {
    console.error("[lead-finder/campaigns/:id/discover] error", err);
    return NextResponse.json(
      { error: "Lead discovery failed" },
      { status: 500 }
    );
  }
}
