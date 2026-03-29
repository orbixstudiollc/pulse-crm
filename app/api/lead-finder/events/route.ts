import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  leadEmitter,
  type LeadEventType,
  type LeadEventMap,
} from "@/lib/lead-finder/events/emitter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = req.nextUrl.searchParams.get("campaignId");
  const filterCampaignId = campaignId || null;

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

      const eventTypes: LeadEventType[] = [
        "lead:discovered",
        "lead:kpi-updated",
        "lead:enrichment-completed",
        "lead:status-changed",
        "campaign:discovery-started",
        "campaign:discovery-completed",
        "campaign:enrichment-progress",
      ];

      const unsubscribers = eventTypes.map((eventType) =>
        leadEmitter.on(
          eventType,
          (data: LeadEventMap[typeof eventType]) => {
            if (
              filterCampaignId &&
              "campaignId" in data &&
              (data as { campaignId: string }).campaignId !==
                filterCampaignId
            )
              return;
            send(eventType, data);
          }
        )
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
