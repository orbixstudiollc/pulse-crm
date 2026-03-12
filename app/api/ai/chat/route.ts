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
        lookupContact: tool({
          description:
            "Look up a contact by name, email, or company. Returns contact details.",
          inputSchema: z.object({
            query: z
              .string()
              .describe("Contact name, email, or company to search for"),
          }),
          execute: async ({ query }) => {
            const supabase = await createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return "Not authenticated.";
            const { data: prof } = await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", user.id)
              .single();
            if (!prof?.organization_id) return "No organization.";
            const { data } = await supabase
              .from("contacts")
              .select(
                "id, name, email, phone, title"
              )
              .eq("organization_id", prof.organization_id)
              .or(
                `name.ilike.%${query}%,email.ilike.%${query}%`
              )
              .limit(10);
            return data?.length
              ? `Found ${data.length} contacts:\n${data.map((c) => `- ${c.name} - ${c.title || "N/A"}, ${c.email || "N/A"}`).join("\n")}`
              : "No contacts found matching query.";
          },
        }),
        searchDeals: tool({
          description:
            "Search deals by name, stage, or value range. Returns matching deals.",
          inputSchema: z.object({
            query: z
              .string()
              .optional()
              .describe("Deal name to search for"),
            stage: z
              .string()
              .optional()
              .describe(
                "Filter by stage (e.g. qualification, proposal, negotiation)"
              ),
            minValue: z
              .number()
              .optional()
              .describe("Minimum deal value"),
          }),
          execute: async ({ query, stage, minValue }) => {
            const supabase = await createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return "Not authenticated.";
            const { data: prof } = await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", user.id)
              .single();
            if (!prof?.organization_id) return "No organization.";
            let q = supabase
              .from("deals")
              .select(
                "id, name, value, stage, probability, close_date, contact_name"
              )
              .eq("organization_id", prof.organization_id);
            if (query) q = q.ilike("name", `%${query}%`);
            if (stage) q = q.eq("stage", stage as "discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost");
            if (minValue) q = q.gte("value", minValue);
            const { data } = await q
              .order("value", { ascending: false })
              .limit(15);
            return data?.length
              ? `Found ${data.length} deals:\n${data.map((d) => `- ${d.name}: $${(d.value || 0).toLocaleString()} (${d.stage}, ${d.probability || 0}% prob, close: ${d.close_date || "TBD"}) Contact: ${d.contact_name || "N/A"}`).join("\n")}`
              : "No deals found matching criteria.";
          },
        }),
        getLeadScore: tool({
          description:
            "Get the scoring details for a specific lead including score breakdown and history.",
          inputSchema: z.object({
            leadNameOrEmail: z
              .string()
              .describe("Lead name or email to look up scoring for"),
          }),
          execute: async ({ leadNameOrEmail }) => {
            const supabase = await createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return "Not authenticated.";
            const { data: prof } = await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", user.id)
              .single();
            if (!prof?.organization_id) return "No organization.";
            const { data: leads } = await supabase
              .from("leads")
              .select(
                "id, name, email, score, status, company, qualification_data"
              )
              .eq("organization_id", prof.organization_id)
              .or(
                `name.ilike.%${leadNameOrEmail}%,email.ilike.%${leadNameOrEmail}%`
              )
              .limit(3);
            if (!leads?.length) return "No leads found.";
            const lead = leads[0];
            const { data: history } = await supabase
              .from("lead_score_history")
              .select("score, breakdown, scored_at")
              .eq("lead_id", lead.id)
              .order("scored_at", { ascending: false })
              .limit(5);
            const dims = history?.[0]?.breakdown as
              | Record<string, number>
              | undefined;
            return `**Lead Score: ${lead.name}**
Score: ${lead.score ?? "Unscored"} / 100
Status: ${lead.status}
Company: ${lead.company || "N/A"}
${dims ? `\nScore Breakdown:\n- Fit: ${dims.fit}/100\n- Engagement: ${dims.engagement}/100\n- Intent: ${dims.intent}/100\n- Timing: ${dims.timing}/100\n- Budget: ${dims.budget}/100` : ""}
${lead.qualification_data ? `\nQualification: ${JSON.stringify(lead.qualification_data)}` : ""}
${history?.length ? `\nScore History:\n${history.map((h) => `- ${h.score}/100 on ${new Date(h.scored_at).toLocaleDateString()}`).join("\n")}` : ""}`;
          },
        }),
        createNewDeal: tool({
          description:
            "Create a new deal in the pipeline. Use this when the user asks to create or add a deal.",
          inputSchema: z.object({
            name: z.string().describe("Deal name"),
            value: z.number().optional().describe("Deal value in dollars"),
            stage: z
              .enum(["discovery", "proposal", "negotiation"])
              .optional()
              .default("discovery"),
            contact_name: z
              .string()
              .optional()
              .describe("Contact name for the deal"),
            company: z.string().optional().describe("Company name"),
          }),
          execute: async ({ name, value, stage, contact_name, company }) => {
            const supabase = await createClient();
            const {
              data: { user: u },
            } = await supabase.auth.getUser();
            if (!u) return "Not authenticated.";
            const { data: prof } = await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", u.id)
              .single();
            if (!prof?.organization_id) return "No organization.";
            const { data, error } = await supabase
              .from("deals")
              .insert({
                organization_id: prof.organization_id,
                owner_id: u.id,
                name,
                value: value || 0,
                stage: stage || "discovery",
                contact_name: contact_name || null,
                company: company || null,
                probability:
                  stage === "discovery"
                    ? 10
                    : stage === "proposal"
                      ? 30
                      : 50,
              })
              .select("id, name, value, stage")
              .single();
            if (error) return `Failed to create deal: ${error.message}`;
            return `**Deal Created Successfully**\nName: ${data.name}\nValue: $${(data.value || 0).toLocaleString()}\nStage: ${data.stage}\nID: ${data.id}`;
          },
        }),
        logDealActivity: tool({
          description:
            "Log an activity (call, email, meeting, note, task) for a deal.",
          inputSchema: z.object({
            dealId: z
              .string()
              .describe("The deal ID to log activity for"),
            type: z
              .enum(["call", "email", "meeting", "note", "task"])
              .describe("Activity type"),
            title: z.string().describe("Activity title/summary"),
            description: z
              .string()
              .optional()
              .describe("Detailed description"),
          }),
          execute: async ({ dealId, type, title, description }) => {
            const supabase = await createClient();
            const {
              data: { user: u },
            } = await supabase.auth.getUser();
            if (!u) return "Not authenticated.";
            const { data: prof } = await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", u.id)
              .single();
            if (!prof?.organization_id) return "No organization.";
            const { error } = await supabase
              .from("deal_activities")
              .insert({
                deal_id: dealId,
                organization_id: prof.organization_id,
                user_id: u.id,
                type,
                title,
                description: description || null,
              });
            if (error) return `Failed to log activity: ${error.message}`;
            return `**Activity Logged**\nType: ${type}\nTitle: ${title}\nDeal: ${dealId}`;
          },
        }),
        addDealNote: tool({
          description: "Add a note to a deal.",
          inputSchema: z.object({
            dealId: z.string().describe("The deal ID"),
            content: z.string().describe("Note content"),
          }),
          execute: async ({ dealId, content }) => {
            const supabase = await createClient();
            const {
              data: { user: u },
            } = await supabase.auth.getUser();
            if (!u) return "Not authenticated.";
            const { data: prof } = await supabase
              .from("profiles")
              .select("organization_id, first_name, last_name")
              .eq("id", u.id)
              .single();
            if (!prof?.organization_id) return "No organization.";
            const authorName = [prof.first_name, prof.last_name].filter(Boolean).join(" ") || u.email || "Unknown";
            const { error } = await supabase.from("deal_notes").insert({
              deal_id: dealId,
              author_id: u.id,
              author_name: authorName,
              content,
            });
            if (error) return `Failed to add note: ${error.message}`;
            return `**Note Added**\nDeal: ${dealId}\nContent: ${content}`;
          },
        }),
        getAnalyticsSummary: tool({
          description:
            "Get a summary of sales analytics including conversion rates, revenue trends, and activity metrics.",
          inputSchema: z.object({
            period: z
              .enum(["week", "month", "quarter"])
              .optional()
              .describe("Time period for analytics"),
          }),
          execute: async ({ period }) => {
            const supabase = await createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return "Not authenticated.";
            const { data: prof } = await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", user.id)
              .single();
            if (!prof?.organization_id) return "No organization.";
            const days =
              period === "quarter" ? 90 : period === "month" ? 30 : 7;
            const since = new Date(
              Date.now() - days * 86400000
            ).toISOString();
            const [dealsRes, leadsRes, activitiesRes, wonRes] =
              await Promise.all([
                supabase
                  .from("deals")
                  .select("value, stage, created_at")
                  .eq("organization_id", prof.organization_id),
                supabase
                  .from("leads")
                  .select("id, status, created_at")
                  .eq("organization_id", prof.organization_id)
                  .gte("created_at", since),
                supabase
                  .from("activities")
                  .select("id, type")
                  .eq("organization_id", prof.organization_id)
                  .gte("created_at", since),
                supabase
                  .from("deals")
                  .select("value")
                  .eq("organization_id", prof.organization_id)
                  .eq("stage", "closed_won")
                  .gte("created_at", since),
              ]);
            const allDeals = dealsRes.data || [];
            const newLeads = leadsRes.data?.length || 0;
            const activities = activitiesRes.data || [];
            const wonDeals = wonRes.data || [];
            const wonValue = wonDeals.reduce(
              (s, d) => s + (d.value || 0),
              0
            );
            const totalPipeline = allDeals
              .filter(
                (d) => !["closed_won", "closed_lost"].includes(d.stage)
              )
              .reduce((s, d) => s + (d.value || 0), 0);
            const actByType: Record<string, number> = {};
            activities.forEach((a) => {
              actByType[a.type] = (actByType[a.type] || 0) + 1;
            });
            return `**Analytics Summary (Last ${days} days)**
New Leads: ${newLeads}
Deals Won: ${wonDeals.length} ($${wonValue.toLocaleString()})
Active Pipeline: $${totalPipeline.toLocaleString()} (${allDeals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage)).length} deals)
Activities: ${activities.length}
${Object.keys(actByType).length ? `Activity Breakdown:\n${Object.entries(actByType).map(([t, c]) => `- ${t}: ${c}`).join("\n")}` : ""}`;
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
