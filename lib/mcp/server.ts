import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import type { ApiKeyContext } from "./api-keys";
import type { Db } from "./shared";
import { registerReadTools } from "./tools-read";
import { registerWriteTools } from "./tools-write";

const INSTRUCTIONS = `Pulse CRM workspace tools.

Data model: leads (prospects, status hot/warm/cold) become customers (paying accounts) via convert_lead_to_customer. Deals sit in a pipeline: discovery -> proposal -> negotiation -> closed_won / closed_lost. Contacts are people at a lead or customer account. Activities are calls, meetings, emails, notes and tasks (type "task", status pending -> completed), optionally linked to a lead, deal or customer. Follow-ups are dates on a lead (next_followup).

Tips: call get_workspace_summary first. Search tools return compact rows; use get_lead / get_deal / get_customer for full detail with notes and timeline. Ids are UUIDs from search results; never invent one. Dates are YYYY-MM-DD. Empty fields are omitted from results. Confirm with the user before delete_record or convert_lead_to_customer.`;

/**
 * Builds an MCP server bound to one workspace. Read-scope keys only get the
 * read tools, so a read-only client never even sees a write tool.
 */
export function createPulseMcpServer(ctx: ApiKeyContext, db: Db = createAdminClient()): McpServer {
  const server = new McpServer(
    { name: "pulse-crm", version: "1.0.0" },
    { instructions: INSTRUCTIONS, capabilities: { tools: {}, prompts: {} } },
  );

  const env = { db, ctx };
  registerReadTools(server, env);
  if (ctx.scope === "write") registerWriteTools(server, env);

  // Prompts show up as slash commands in Claude Code and as templates elsewhere.
  server.registerPrompt(
    "daily_briefing",
    {
      title: "Daily sales briefing",
      description: "What needs attention today: overdue follow-ups, open tasks, today's events and stalled deals.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Give me my Pulse CRM briefing for today. Use get_workspace_summary, list_followups (overdue and next 2 days), list_activities (status pending), list_calendar_events for today, and search_deals for open deals sorted by close_date. Flag deals that have sat in one stage for more than 14 days or are past their close date. Finish with the five most important actions, each naming the record.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "pipeline_review",
    {
      title: "Pipeline review",
      description: "Review open deals by stage and suggest next steps.",
      argsSchema: { stage: z.string().optional().describe("Limit to one stage, e.g. negotiation") },
    },
    ({ stage }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review my Pulse CRM pipeline${stage ? ` for the ${stage} stage` : ""}. Use search_deals (and get_deal for the largest ones). For each deal give value, probability, days in stage and days to close, then a concrete next step. End with total and weighted pipeline value and the three deals most at risk.`,
          },
        },
      ],
    }),
  );

  return server;
}
