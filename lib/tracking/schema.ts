import { isIP } from "node:net";
import { z } from "zod";
import { isPrivateHostname } from "@/lib/security";

export const TRACKING_MAX_BODY_BYTES = 16_384;

export const trackingEventSchema = z.object({
  script_key: z.string().min(1).max(64),
  session_id: z.string().max(128).optional(),
  page_url: z.string().url().max(2048),
  page_title: z.string().max(512).optional(),
  referrer: z.string().max(2048).optional(),
  duration: z.number().int().min(0).max(86_400_000).optional(),
  scroll_depth: z.number().min(0).max(100).optional(),
});

export type TrackingEvent = z.infer<typeof trackingEventSchema>;

// Vercel overwrites both x-real-ip and x-forwarded-for at the edge, so the
// client cannot spoof them there. Anything that is not a public IP is dropped.
export function clientIpFromHeaders(get: (name: string) => string | null): string | null {
  const ip = (get("x-real-ip") ?? get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  if (!isIP(ip) || isPrivateHostname(ip)) return null;
  return ip;
}
