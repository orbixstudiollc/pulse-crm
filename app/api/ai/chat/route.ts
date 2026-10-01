import { after } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  tool,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { z } from "zod";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { assembleContext, fetchEntityForChat } from "@/lib/ai/context";
import { createAIMessagesClient, logTokenUsage, tokenLimitReason } from "@/lib/ai/client";
import { getModelId } from "@/lib/ai/models";
import { customModelSettingsFor, resolveAIProvider } from "@/lib/ai/provider-resolver";
import { sharedTurnBudget } from "@/lib/ai/shared-budget";
import { SharedBudgetError } from "@/lib/ai/shared-budget-core";
import { aiSdkBaseUrl, createCustomFetch, customModelFor } from "@/lib/ai/custom-provider";
import { checkRateLimit, acquireRateLimit } from "@/lib/ai/rate-limiter";
import { toChatMessages } from "@/lib/ai/chat-messages";
import { PageContext } from "@/lib/ai/types";
import { escapePostgrestLike } from "@/lib/security";

export const maxDuration = 60;

/** Tool-use steps per chat turn (stopWhen). */
const CHAT_MAX_STEPS = 3;
/** Output cap per step on the owner's shared (env) key. */
const SHARED_CHAT_MAX_OUTPUT_TOKENS = 4096;

export async function POST(req: Request) {
  let releaseRateLimit: (() => void) | null = null;
  let closeCustomFetch: (() => void) | null = null;
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

    // Get AI settings for API key (secret columns are only readable with the service role)
    const { data: settings } = await createAdminClient()
      .from("ai_settings")
      .select(
        "organization_id, api_key, feature_chat, ai_provider, openrouter_api_key, openrouter_oauth_token, openrouter_expires_at, openai_api_key, groq_api_key, ollama_base_url, custom_base_url, custom_api_key, custom_model, custom_fast_model, daily_token_limit, monthly_token_limit, tokens_used_today, tokens_used_month, last_token_reset_daily, last_token_reset_monthly"
      )
      .eq("organization_id", profile.organization_id)
      .single();

    if (settings && !settings.feature_chat) {
      return new Response("AI Chat is disabled in settings", { status: 403 });
    }

    const limitReason = settings ? tokenLimitReason(settings) : null;
    if (limitReason) {
      return Response.json({ error: limitReason }, { status: 429 });
    }

    const notConfigured = () =>
      new Response(
        "AI isn't set up for this workspace yet. Add a provider in Settings → AI Assistant.",
        { status: 400 }
      );
    const resolved = resolveAIProvider(settings ?? {}, process.env);
    if (!resolved) return notConfigured();
    const provider = resolved.provider;

    // Model for the streaming (Anthropic protocol) branch below.
    let modelId: string;
    switch (provider) {
      case "custom": {
        // The env fallback uses its own models, never the org's custom_* fields.
        const customModel = customModelFor("sonnet", customModelSettingsFor(resolved, settings) ?? {});
        if (!customModel || !resolved.baseURL) return notConfigured();
        // Without a key the SDK would fall back to ANTHROPIC_API_KEY from env.
        if (!resolved.apiKey) return notConfigured();
        modelId = customModel;
        break;
      }
      case "openrouter":
        modelId = "anthropic/claude-sonnet-4-6";
        break;
      default:
        modelId = "claude-sonnet-4-6";
    }

    const orgId = profile.organization_id;
    // The owner's shared (env) key is limited per workspace and site-wide per
    // UTC day, and guests (anonymous users) also share a smaller guest pool:
    // tokens are reserved before each call (below, per step, or in the client
    // for the OpenAI-compatible branch). Refusals are plain text so the chat
    // UI shows the reason as is.
    const sharedKey = resolved.source === "env";
    const isGuest = user.is_anonymous === true;

    const rateCheck = checkRateLimit(orgId);
    if (!rateCheck.allowed) {
      const retryAfterSec = Math.ceil((rateCheck.retryAfterMs || 1000) / 1000);
      return Response.json(
        { error: `Rate limit exceeded. Please try again in ${retryAfterSec} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }
    const release = acquireRateLimit(orgId);
    let released = false;
    const guardedRelease = () => {
      if (released) return;
      released = true;
      release();
    };
    releaseRateLimit = guardedRelease;
    // On the shared key the call runs to completion after a disconnect (so its
    // real usage is settled); the slot is freed when it ends, not on abort.
    if (!sharedKey) req.signal.addEventListener("abort", guardedRelease);

    const { messages: rawMessages, data } = await req.json();
    const pageContext: PageContext | undefined = data?.pageContext;

    // User/assistant text only: client-supplied file/image parts or system/tool
    // roles never reach the model (see lib/ai/chat-messages.ts).
    const messages = toChatMessages(rawMessages);
    if (messages.length === 0) {
      guardedRelease();
      return Response.json({ error: "No message to send." }, { status: 400 });
    }

    // Build context from current page
    let contextStr = "";
    if (pageContext) {
      contextStr = await assembleContext(pageContext);
    }

    const fullName = user.user_metadata?.full_name;
    const userLabel = (typeof fullName === "string" && fullName) || user.email;

    const systemMessage = `${SYSTEM_PROMPTS.chat}

${contextStr ? `\n---\nCurrent CRM Context:\n${contextStr}` : ""}

Current date: ${new Date().toLocaleDateString()}${userLabel ? `\nUser: ${userLabel}` : ""}`;

    const startTime = Date.now();

    if (provider !== "anthropic" && provider !== "openrouter" && provider !== "custom") {
      // OpenAI-compatible providers (OpenAI, Groq, Ollama): one completion
      // without CRM tools, delivered as a single text part of the UI stream.
      const client = createAIMessagesClient(resolved, null, orgId, isGuest);
      const chatMessages = (messages as Array<{ role: string; content?: unknown }>).filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.length > 0
      );
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          try {
            const response = await client.messages.create({
              model: getModelId("sonnet", provider),
              max_tokens: 4096,
              system: systemMessage,
              messages: chatMessages,
            });
            const text = response.content
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("");
            const id = crypto.randomUUID();
            writer.write({ type: "start" });
            writer.write({ type: "text-start", id });
            writer.write({ type: "text-delta", id, delta: text });
            writer.write({ type: "text-end", id });
            writer.write({ type: "finish" });
            await logTokenUsage({
              orgId,
              userId: user.id,
              feature: "chat",
              model: response.model,
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              durationMs: Date.now() - startTime,
              success: true,
              sharedKey,
              metadata: { provider },
            });
          } finally {
            guardedRelease();
          }
        },
        onError: (error) => {
          // The shared-key reservation was refused: show the reason.
          if (error instanceof SharedBudgetError) return error.message;
          console.error("AI Chat error:", error);
          return "The AI provider request failed. Please try again.";
        },
      });
      return createUIMessageStreamResponse({ stream });
    }

    let anthropicOptions: Parameters<typeof createAnthropic>[0];
    if (provider === "custom" && resolved.baseURL) {
      // SECURITY: the resolved URL (the org's, or the env fallback's, always
      // paired with its own key) goes through a fetch pinned to the validated
      // public addresses. Closed exactly once when the
      // stream finishes, errors, or the client disconnects.
      let pinned: Awaited<ReturnType<typeof createCustomFetch>>;
      try {
        pinned = await createCustomFetch(resolved.baseURL);
      } catch (err) {
        guardedRelease();
        return new Response(
          err instanceof Error ? err.message : "Custom AI base URL is not allowed",
          { status: 400 }
        );
      }
      let fetchClosed = false;
      const guardedClose = () => {
        if (fetchClosed) return;
        fetchClosed = true;
        pinned.close().catch((err) => console.error("AI Chat: closing custom fetch failed:", err));
      };
      closeCustomFetch = guardedClose;
      if (!sharedKey) req.signal.addEventListener("abort", guardedClose);
      anthropicOptions = {
        apiKey: resolved.apiKey,
        baseURL: aiSdkBaseUrl(pinned.base),
        fetch: pinned.fetch,
      };
    } else if (provider === "openrouter") {
      anthropicOptions = {
        apiKey: resolved.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://pulse-crm-weld.vercel.app",
          "X-Title": "Pulse CRM",
        },
      };
    } else {
      anthropicOptions = { apiKey: resolved.apiKey };
    }
    const anthropic = createAnthropic(anthropicOptions);

    // Shared key: reserve per step. The first step (input plus one output
    // cap) is reserved here; each further step is reserved by stopWhen before
    // it runs, with the input it will resend, and a refusal ends the turn with
    // what exists. onFinish settles every reservation to real usage; a failed
    // stream keeps them in full.
    const turnBudget = sharedKey
      ? sharedTurnBudget({
          orgId,
          isGuest,
          baseInput: systemMessage + JSON.stringify(messages),
          maxOutputTokens: SHARED_CHAT_MAX_OUTPUT_TOKENS,
          maxSteps: CHAT_MAX_STEPS,
        })
      : null;
    if (turnBudget) {
      const first = await turnBudget.start();
      if (!first.ok) {
        guardedRelease();
        closeCustomFetch?.();
        return new Response(first.reason, { status: 429 });
      }
    }
    let streamFailed = false;

    const result = streamText({
      model: anthropic(modelId),
      system: systemMessage,
      messages,
      ...(sharedKey ? { maxOutputTokens: SHARED_CHAT_MAX_OUTPUT_TOKENS } : {}),
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
                (() => {
                  const q = escapePostgrestLike(query);
                  return `name.ilike.%${q}%,email.ilike.%${q}%`;
                })()
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
            if (query) q = q.ilike("name", `%${escapePostgrestLike(query)}%`);
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
                (() => {
                  const q = escapePostgrestLike(leadNameOrEmail);
                  return `name.ilike.%${q}%,email.ilike.%${q}%`;
                })()
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
      stopWhen: turnBudget ? turnBudget.stopWhen : stepCountIs(CHAT_MAX_STEPS),
      // The shared key never forwards the client's abort: the provider call
      // finishes so onFinish can settle the real usage.
      ...(sharedKey ? {} : { abortSignal: req.signal }),
      onAbort: () => {
        guardedRelease();
        closeCustomFetch?.();
      },
      onError: ({ error }) => {
        streamFailed = true;
        guardedRelease();
        closeCustomFetch?.();
        console.error("AI Chat stream error:", error);
      },
      onFinish: async ({ totalUsage, steps }) => {
        guardedRelease();
        closeCustomFetch?.();
        const durationMs = Date.now() - startTime;
        if (turnBudget && !streamFailed) await turnBudget.settle(steps);
        await logTokenUsage({
          orgId: profile.organization_id!,
          userId: user.id,
          feature: "chat",
          model: modelId,
          inputTokens: totalUsage?.inputTokens || 0,
          outputTokens: totalUsage?.outputTokens || 0,
          durationMs,
          success: true,
          sharedKey,
        });
      },
    });

    if (sharedKey) {
      // Read the stream to the end on the server even if the client goes
      // away (it then just stops receiving), and keep the function alive
      // until onFinish has settled.
      const consumed = Promise.resolve(
        result.consumeStream({ onError: (error) => console.error("AI Chat stream error:", error) })
      ).finally(() => {
        guardedRelease();
        closeCustomFetch?.();
      });
      after(() => consumed);
    }

    return result.toUIMessageStreamResponse();
  } catch (error) {
    releaseRateLimit?.();
    closeCustomFetch?.();
    console.error("AI Chat error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}
