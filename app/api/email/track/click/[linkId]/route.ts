import { createAdminClient } from "@/lib/supabase/server";
import { recordTrackingEvent } from "@/lib/email/tracking";
import { redirect } from "next/navigation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const { linkId } = await params;
  const supabase = createAdminClient();

  // Get original URL
  const { data: link } = await supabase
    .from("email_link_tracking")
    .select("original_url, message_id")
    .eq("id", linkId)
    .single();

  if (!link) {
    return new Response("Link not found", { status: 404 });
  }

  // Increment click count on the link
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

  // Record click event (fire-and-forget)
  recordTrackingEvent(link.message_id, "clicked", {
    link_id: linkId,
    original_url: link.original_url,
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    user_agent: request.headers.get("user-agent"),
  }).catch(() => {});

  // Redirect to original URL
  redirect(link.original_url);
}
