import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Must match the `deals.stage` enum in the generated Supabase types.
const DEAL_STAGES = [
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

const ACTIVITY_TYPES = ["call", "meeting", "task", "email", "note"] as const;

const actionSchema = z.discriminatedUnion("actionId", [
  z.object({
    actionId: z.literal("createDeal"),
    params: z.object({
      name: z.string().min(1).max(256),
      value: z.number().nonnegative().max(1_000_000_000).optional(),
      stage: z.enum(DEAL_STAGES).optional(),
      contact_name: z.string().max(256).nullish(),
      contact_email: z.string().email().max(320).nullish(),
      notes: z.string().max(10_000).nullish(),
    }),
  }),
  z.object({
    actionId: z.literal("updateDealStage"),
    params: z.object({
      dealId: z.string().uuid(),
      newStage: z.enum(DEAL_STAGES),
    }),
  }),
  z.object({
    actionId: z.literal("createActivity"),
    params: z.object({
      dealId: z.string().uuid(),
      type: z.enum(ACTIVITY_TYPES),
      title: z.string().min(1).max(256),
      description: z.string().max(10_000).nullish(),
    }),
  }),
  z.object({
    actionId: z.literal("generateEmail"),
    params: z.object({
      to: z.string().max(2000),
      subject: z.string().max(998),
      body: z.string().max(100_000),
    }),
  }),
]);

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    let parsed: z.infer<typeof actionSchema>;
    try {
      parsed = actionSchema.parse(await req.json());
    } catch (err) {
      const message =
        err instanceof z.ZodError
          ? err.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const orgId = profile.organization_id;

    switch (parsed.actionId) {
      case "createDeal": {
        const p = parsed.params;
        const { data, error } = await supabase
          .from("deals")
          .insert({
            organization_id: orgId,
            name: p.name,
            value: p.value ?? 0,
            stage: p.stage ?? "discovery",
            stage_changed_at: new Date().toISOString(),
            contact_name: p.contact_name ?? null,
            contact_email: p.contact_email ?? null,
            notes: p.notes ?? null,
            probability: 10,
          })
          .select("id, name")
          .single();

        if (error) {
          console.error("[ai/chat/execute-action] createDeal", error);
          return NextResponse.json(
            { error: "Unable to create deal" },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          message: `Deal "${data.name}" created successfully.`,
          data,
        });
      }

      case "updateDealStage": {
        const p = parsed.params;
        // SECURITY: guard with org filter so a user cannot move deals in
        // another tenant.
        const { error, count } = await supabase
          .from("deals")
          .update(
            {
              stage: p.newStage,
              stage_changed_at: new Date().toISOString(),
            },
            { count: "exact" }
          )
          .eq("id", p.dealId)
          .eq("organization_id", orgId);

        if (error) {
          console.error("[ai/chat/execute-action] updateDealStage", error);
          return NextResponse.json(
            { error: "Unable to update deal" },
            { status: 500 }
          );
        }
        if (!count) {
          return NextResponse.json(
            { error: "Deal not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          message: `Deal moved to ${p.newStage}.`,
        });
      }

      case "createActivity": {
        const p = parsed.params;
        // SECURITY: verify deal ownership before attaching an activity.
        const { data: deal } = await supabase
          .from("deals")
          .select("id")
          .eq("id", p.dealId)
          .eq("organization_id", orgId)
          .maybeSingle();
        if (!deal) {
          return NextResponse.json(
            { error: "Deal not found" },
            { status: 404 }
          );
        }

        const { error } = await supabase.from("deal_activities").insert({
          deal_id: p.dealId,
          organization_id: orgId,
          user_id: user.id,
          type: p.type,
          title: p.title,
          description: p.description ?? null,
        });

        if (error) {
          console.error("[ai/chat/execute-action] createActivity", error);
          return NextResponse.json(
            { error: "Unable to log activity" },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          message: `Activity "${p.title}" logged.`,
        });
      }

      case "generateEmail": {
        return NextResponse.json({
          success: true,
          message: "Email draft generated. Copy the content above to send.",
          data: parsed.params,
        });
      }
    }
  } catch (error) {
    console.error("Execute action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
