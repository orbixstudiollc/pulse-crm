import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import {
  generateCompletion,
  logLlmCost,
  resolveProviderAndModel,
} from "@/lib/lead-finder/ai-provider";
import { SharedBudgetError } from "@/lib/ai/shared-budget-core";

export const runtime = "nodejs";

const BodySchema = z.object({
  context: z.string().trim().min(1, "Context is required").max(20_000),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { provider } = await resolveProviderAndModel(orgId, "openai");

  try {
    const response = await generateCompletion(
      [
        {
          role: "system",
          content: `You extract structured agency profile information from freeform text. The user will provide raw context about their agency — it could be website copy, an about page, pitch notes, or informal descriptions.

Extract the following fields and return them as a JSON object:
- "agency_name": The agency's name
- "agency_description": A concise 1-3 sentence description of what the agency does and their unique approach
- "agency_services": Key services they offer, as a comma-separated list
- "agency_results": Notable results, case studies, or social proof (keep it concise, data-driven where possible)
- "agency_target_industries": Industries they serve, comma-separated
- "agency_website": Their website URL if mentioned
- "sender_first_name": The first name of the primary contact/sender if mentioned
- "sender_last_name": The last name of the primary contact/sender if mentioned
- "sender_email": The email address of the primary contact/sender if mentioned

Only include fields where you found clear information. For missing fields, use an empty string "".
Return ONLY valid JSON, no markdown, no code fences.`,
        },
        {
          role: "user",
          content: `Extract agency profile details from this context:\n\n${parsed.data.context}`,
        },
      ],
      provider,
      orgId,
      { temperature: 0.3, maxTokens: 1024 }
    );

    // Non-blocking cost logging — never fail the user request on a logging issue
    logLlmCost(response, "profile-generation", orgId).catch((err) =>
      console.error("[generate-profile] logLlmCost failed", err)
    );

    try {
      const cleaned = response.content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const profile = JSON.parse(cleaned);
      return NextResponse.json(profile);
    } catch (parseErr) {
      console.error(
        "[generate-profile] parse failed",
        parseErr,
        response.content.slice(0, 200)
      );
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 502 }
      );
    }
  } catch (err) {
    if (err instanceof SharedBudgetError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("[generate-profile]", err);
    return NextResponse.json(
      { error: "Failed to generate agency profile" },
      { status: 500 }
    );
  }
}
