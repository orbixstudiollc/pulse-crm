import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const { actionId, params } = await req.json();

    switch (actionId) {
      case "createDeal": {
        const { data, error } = await supabase
          .from("deals")
          .insert({
            organization_id: profile.organization_id,
            name: params.name,
            value: params.value || 0,
            stage: params.stage || "qualification",
            contact_name: params.contact_name || null,
            contact_email: params.contact_email || null,
            notes: params.notes || null,
            probability: 10,
          })
          .select("id, name")
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: `Deal "${data.name}" created successfully.`, data });
      }

      case "updateDealStage": {
        const { error } = await supabase
          .from("deals")
          .update({ stage: params.newStage, days_in_stage: 0 })
          .eq("id", params.dealId)
          .eq("organization_id", profile.organization_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: `Deal moved to ${params.newStage}.` });
      }

      case "createActivity": {
        const { error } = await supabase
          .from("deal_activities")
          .insert({
            deal_id: params.dealId,
            organization_id: profile.organization_id,
            user_id: user.id,
            type: params.type,
            title: params.title,
            description: params.description || null,
          });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: `Activity "${params.title}" logged.` });
      }

      case "generateEmail": {
        // Email generation is a draft action - just confirms the AI-generated content
        return NextResponse.json({
          success: true,
          message: "Email draft generated. Copy the content above to send.",
          data: {
            to: params.to,
            subject: params.subject,
            body: params.body,
          },
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${actionId}` }, { status: 400 });
    }
  } catch (error) {
    console.error("Execute action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
