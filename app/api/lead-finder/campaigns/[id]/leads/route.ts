import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { isUuid } from "@/lib/security";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId();

  const { error } = await supabase
    .from("lf_leads")
    .delete()
    .eq("campaign_id", id)
    .eq("organization_id", orgId);

  if (error) {
    console.error("[lead-finder/campaigns/:id/leads] delete error", error);
    return NextResponse.json(
      { error: "Failed to delete campaign leads" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
