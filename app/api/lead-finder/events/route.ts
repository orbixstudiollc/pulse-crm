import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import {
  leadEmitter,
  type LeadEventType,
  type LeadEventMap,
} from "@/lib/lead-finder/events/emitter";
import { isUuid } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // AuthN
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tenancy: resolve the caller's org, then build the set of allowed campaign
  // ids that this connection may receive events for. Events carrying any other
  // campaign id are silently dropped server-side, so a client cannot escalate
  // by omitting the filter.
  const orgId = await getOrgId();

  const requestedCampaignId = req.nextUrl.searchParams.get("campaignId");
  if (requestedCampaignId !== null && !isUuid(requestedCampaignId)) {
    return NextResponse.json(
      { error: "Invalid campaignId" },
      { status: 400 }
    );
  }

  // Load the ids of campaigns the caller is allowed to see.
  const { data: campaigns, error: campaignsErr } = requestedCampaignId
    ? await supabase
        .from("lf_campaigns")
        .select("id")
        .eq("organization_id", orgId)
        .eq("id", requestedCampaignId)
    : await supabase
        .from("lf_campaigns")
        .select("id")
        .eq("organization_id", orgId);

  if (campaignsErr) {
    return NextResponse.json(
      { error: "Unable to resolve campaigns" },
      { status: 500 }
    );
  }

  const allowedCampaignIds = new Set<string>(
    (campaigns ?? []).map((c) => c.id)
  );

  // If the caller asked for a specific campaign but it doesn't belong to them,
  // fail closed.
  if (requestedCampaignId && !allowedCampaignIds.has(requestedCampaignId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If the caller has no campaigns at all, still open the stream (empty) so
  // the browser's EventSource doesn't retry-loop; it simply receives nothing.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            )
          );
        } catch {
          /* disconnected */
        }
      };

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      const campaignScopedEvents: LeadEventType[] = [
        "lead:discovered",
        "lead:kpi-updated",
        "lead:enrichment-completed",
        "lead:status-changed",
        "campaign:discovery-started",
        "campaign:discovery-completed",
        "campaign:enrichment-progress",
      ];

      const unsubscribers = campaignScopedEvents.map((eventType) =>
        leadEmitter.on(
          eventType,
          (data: LeadEventMap[typeof eventType]) => {
            // Every event payload has a campaignId — drop anything that isn't
            // in the caller's allowlist.
            const cid =
              "campaignId" in data
                ? (data as { campaignId: string }).campaignId
                : null;
            if (!cid || !allowedCampaignIds.has(cid)) return;
            send(eventType, data);
          }
        )
      );

      // enrichment-batch:updated is org-scoped (a batch may outlive a filter
      // on campaignId, and we want dashboards to surface completion even when
      // subscribed to "all my campaigns"). Filter by organizationId on the
      // payload and — when a specific campaignId was requested — by that too.
      unsubscribers.push(
        leadEmitter.on("enrichment-batch:updated", (data) => {
          if (data.organizationId !== orgId) return;
          if (requestedCampaignId) {
            if (data.campaignId !== requestedCampaignId) return;
          } else if (data.campaignId && !allowedCampaignIds.has(data.campaignId)) {
            return;
          }
          send("enrichment-batch:updated", data);
        })
      );

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribers.forEach((unsub) => unsub());
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
