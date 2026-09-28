import { createAdminClient } from "@/lib/supabase/server";
import { recordTrackingEvent } from "@/lib/email/tracking";
import { redirect } from "next/navigation";
import { isSafeExternalUrl, isUuid } from "@/lib/security";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const { linkId } = await params;
  if (!isUuid(linkId)) {
    return new Response("Invalid link", { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("email_link_tracking")
    .select("original_url, message_id")
    .eq("id", linkId)
    .single();

  if (!link) {
    return new Response("Link not found", { status: 404 });
  }

  const targetUrl = typeof link.original_url === "string" ? link.original_url : "";

  // SECURITY: only allow http(s) redirects to public hosts. This blocks
  // javascript:/data: URLs and SSRF-style redirects to private networks.
  if (!isSafeExternalUrl(targetUrl)) {
    return new Response("Link destination is not allowed", { status: 400 });
  }

  const { data: currentLink } = await supabase
    .from("email_link_tracking")
    .select("click_count")
    .eq("id", linkId)
    .single();
  if (currentLink) {
    await supabase
      .from("email_link_tracking")
      .update({ click_count: currentLink.click_count + 1 })
      .eq("id", linkId);
  }

  recordTrackingEvent(link.message_id, "clicked", {
    link_id: linkId,
    original_url: targetUrl,
    ip:
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip"),
    user_agent: request.headers.get("user-agent"),
  }).catch(() => {});

  redirect(targetUrl);
}
