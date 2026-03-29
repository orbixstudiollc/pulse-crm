import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { suggestLeadFields } from "@/lib/lead-finder/ai/campaign-planner";
import type { AIProvider } from "@/lib/lead-finder/types";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();
    const body = await req.json();
    const { targetNiche, aiProvider } = body as {
      targetNiche: string;
      aiProvider?: AIProvider;
    };

    if (!targetNiche) {
      return NextResponse.json(
        { error: "targetNiche is required" },
        { status: 400 }
      );
    }

    const fields = await suggestLeadFields(
      targetNiche,
      orgId,
      aiProvider || "anthropic"
    );

    // Transform to the format expected by the UI
    return NextResponse.json({
      data: {
        kpi_definitions: [],
        lead_field_definitions: fields.map((f) => ({
          id: f.id,
          label: f.label,
          description: f.description ?? "",
          type: f.type,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
