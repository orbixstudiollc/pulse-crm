import { recordTrackingEvent } from "@/lib/email/tracking";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;

  // Record open event (fire-and-forget)
  recordTrackingEvent(messageId, "opened", {
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    user_agent: request.headers.get("user-agent"),
  }).catch(() => {});

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
