import { createClient } from "@/lib/supabase/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { assembleContext, fetchEntityForChat } from "@/lib/ai/context";
import { logTokenUsage } from "@/lib/ai/client";
import { PageContext } from "@/lib/ai/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response("No organization found", { status: 400 });
    }

    // Get AI settings for API key
    const { data: settings } = await supabase
      .from("ai_settings")
      .select("api_key, feature_chat")
      .eq("organization_id", profile.organization_id)
      .single();

    if (settings && !settings.feature_chat) {
      return new Response("AI Chat is disabled in settings", { status: 403 });
    }

    const apiKey = settings?.api_key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        "No AI API key configured. Add one in Settings > AI or set ANTHROPIC_API_KEY.",
        { status: 400 }
      );
    }

    const { messages, data } = await req.json();
    const pageContext: PageContext | undefined = data?.pageContext;

    // Build context from current page
    let contextStr = "";
    if (pageContext) {
      contextStr = await assembleContext(pageContext);
    }

    const systemMessage = `${SYSTEM_PROMPTS.chat}

${contextStr ? `\n---\nCurrent CRM Context:\n${contextStr}` : ""}

Current date: ${new Date().toLocaleDateString()}
User: ${user.email}`;

    const anthropic = createAnthropic({ apiKey });
    const startTime = Date.now();

    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemMessage,
      messages,
      tools: {
        lookupLead: tool({
          description:
            "Look up a lead by name, email, or company. Returns lead details including score, status, and recent activity.",
          inputSchema: z.object({
            query: z
              .string()
              .describe("Lead name, email, or company to search for"),
          }),
          execute: async ({ query }) => {
            return await fetchEntityForChat("lead", undefined, query);
          },
        }),
        lookupDeal: tool({
          description:
            "Look up a deal by name. Returns deal details including value, stage, and probability.",
          inputSchema: z.object({
            query: z.string().describe("Deal name to search for"),
          }),
          execute: async ({ query }) => {
            return await fetchEntityForChat("deal", undefined, query);
          },
        }),
        lookupCustomer: tool({
          description:
            "Look up a customer by name, email, or company. Returns customer details.",
          inputSchema: z.object({
            query: z
              .string()
              .describe("Customer name, email, or company to search for"),
          }),
          execute: async ({ query }) => {
            return await fetchEntityForChat("customer", undefined, query);
          },
        }),
        getPipelineSummary: tool({
          description:
            "Get a summary of the current sales pipeline including total deals, value, and breakdown by stage.",
          inputSchema: z.object({}),
          execute: async () => {
            return await fetchEntityForChat("pipeline_summary");
          },
        }),
        lookupCompetitor: tool({
          description:
            "Look up a competitor by name. Returns competitor details including strengths, weaknesses, and battle cards.",
          inputSchema: z.object({
            query: z.string().describe("Competitor name to search for"),
          }),
          execute: async ({ query }) => {
            return await fetchEntityForChat("competitor", undefined, query);
          },
        }),
      },
      stopWhen: stepCountIs(3),
      onFinish: async ({ totalUsage }) => {
        const durationMs = Date.now() - startTime;
        await logTokenUsage({
          orgId: profile.organization_id!,
          userId: user.id,
          feature: "chat",
          model: "claude-sonnet-4-20250514",
          inputTokens: totalUsage?.inputTokens || 0,
          outputTokens: totalUsage?.outputTokens || 0,
          durationMs,
          success: true,
        });
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("AI Chat error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}
