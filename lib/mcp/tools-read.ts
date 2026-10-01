import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { escapePostgrestLike } from "@/lib/security";
import { daysToClose, stageDays } from "@/lib/deals/metrics";
import {
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  CUSTOMER_STATUSES,
  DEAL_STAGES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  RELATED_TYPES,
  fail,
  id,
  isoDate,
  ok,
  page,
  safe,
  type ToolEnv,
} from "./shared";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

const LEAD_LIST =
  "id, name, email, company, title, status, source, score, estimated_value, next_followup, converted_customer_id, created_at";
const DEAL_LIST =
  "id, name, company, value, probability, stage, close_date, contact_name, contact_email, customer_id, stage_changed_at, created_at";
const CUSTOMER_LIST =
  "id, first_name, last_name, email, company, status, plan, mrr, health_score, renewal_date, last_contact";
const CONTACT_LIST = "id, name, title, email, phone, buying_role, influence_level, lead_id, customer_id";

type DealTiming = { stage_changed_at: string | null; created_at: string; close_date: string | null };
function withDealTiming<T extends DealTiming>(deal: T) {
  return {
    ...deal,
    days_in_stage: stageDays(deal.stage_changed_at, deal.created_at),
    days_to_close: daysToClose(deal.close_date),
  };
}

function like(search: string) {
  return `%${escapePostgrestLike(search)}%`;
}

export function registerReadTools(server: McpServer, env: ToolEnv) {
  const { db, ctx } = env;
  const orgId = ctx.orgId;

  // ── Overview ─────────────────────────────────────────────────────────────

  server.registerTool(
    "get_workspace_summary",
    {
      title: "Workspace summary",
      description:
        "One-call overview of the CRM: record counts, pipeline value per deal stage, open tasks and overdue follow-ups. Start here to orient yourself.",
      annotations: READ,
    },
    safe(async () => {
      const nowIso = new Date().toISOString();
      const [org, leads, customers, contacts, deals, openActivities, overdue] = await Promise.all([
        db.from("organizations").select("name").eq("id", orgId).maybeSingle(),
        db.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId).is("converted_at", null),
        db.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        db.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        db.from("deals").select("stage, value, probability").eq("organization_id", orgId),
        db
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("status", ["pending", "scheduled"]),
        db
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .is("converted_at", null)
          .lt("next_followup", nowIso),
      ]);
      if (deals.error) return fail(deals.error.message);

      const pipeline = Object.fromEntries(
        DEAL_STAGES.map((stage) => [stage, { count: 0, value: 0, weighted_value: 0 }]),
      ) as Record<string, { count: number; value: number; weighted_value: number }>;
      for (const d of deals.data ?? []) {
        const bucket = pipeline[d.stage];
        if (!bucket) continue;
        bucket.count += 1;
        bucket.value += d.value || 0;
        bucket.weighted_value += Math.round(((d.value || 0) * (d.probability || 0)) / 100);
      }

      return ok({
        workspace: org.data?.name,
        api_key_scope: ctx.scope,
        counts: {
          leads: leads.count ?? 0,
          customers: customers.count ?? 0,
          contacts: contacts.count ?? 0,
          deals: deals.data?.length ?? 0,
          open_activities: openActivities.count ?? 0,
          overdue_followups: overdue.count ?? 0,
        },
        pipeline,
      });
    }),
  );

  // ── Leads ────────────────────────────────────────────────────────────────

  server.registerTool(
    "search_leads",
    {
      title: "Search leads",
      description:
        "List leads, optionally filtered by text (name, email, company), status or source. Newest first unless sorted. Leads already converted to customers are left out unless include_converted is true.",
      inputSchema: {
        search: z.string().optional().describe("Matches name, email or company"),
        status: z.enum(LEAD_STATUSES).optional(),
        source: z.enum(LEAD_SOURCES).optional(),
        include_converted: z.boolean().default(false),
        sort_by: z.enum(["created_at", "score", "estimated_value", "name", "next_followup"]).default("created_at"),
        sort_order: z.enum(["asc", "desc"]).default("desc"),
        ...page,
      },
      annotations: READ,
    },
    safe(async ({ search, status, source, include_converted, sort_by, sort_order, limit, offset }) => {
      let q = db.from("leads").select(LEAD_LIST, { count: "exact" }).eq("organization_id", orgId);
      if (!include_converted) q = q.is("converted_at", null);
      if (search) q = q.or(`name.ilike.${like(search)},email.ilike.${like(search)},company.ilike.${like(search)}`);
      if (status) q = q.eq("status", status);
      if (source) q = q.eq("source", source);
      const { data, count, error } = await q
        .order(sort_by, { ascending: sort_order === "asc", nullsFirst: false })
        .range(offset, offset + limit - 1);
      if (error) return fail(error.message);
      return ok({ total: count ?? 0, offset, leads: data });
    }),
  );

  server.registerTool(
    "get_lead",
    {
      title: "Get lead",
      description: "Full lead record with its notes, activity timeline and contacts.",
      inputSchema: { id },
      annotations: READ,
    },
    safe(async ({ id: leadId }) => {
      const { data: lead, error } = await db
        .from("leads")
        .select("*")
        .eq("organization_id", orgId)
        .eq("id", leadId)
        .maybeSingle();
      if (error) return fail(error.message);
      if (!lead) return fail("Lead not found");
      const [notes, activities, contacts] = await Promise.all([
        db.from("lead_notes").select("author_name, content, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
        db.from("lead_activities").select("type, title, description, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
        db.from("contacts").select(CONTACT_LIST).eq("organization_id", orgId).eq("lead_id", leadId),
      ]);
      return ok({ ...lead, notes: notes.data, activities: activities.data, contacts: contacts.data });
    }),
  );

  server.registerTool(
    "list_followups",
    {
      title: "List follow-ups",
      description: "Leads with a follow-up date: overdue ones, or ones due within the next N days.",
      inputSchema: {
        when: z.enum(["overdue", "upcoming"]).default("overdue"),
        days: z.number().int().min(1).max(90).default(7).describe("Window for upcoming follow-ups"),
      },
      annotations: READ,
    },
    safe(async ({ when, days }) => {
      const now = new Date();
      let q = db
        .from("leads")
        .select("id, name, company, email, status, score, next_followup, followup_note")
        .eq("organization_id", orgId)
        .is("converted_at", null)
        .not("next_followup", "is", null);
      if (when === "overdue") {
        q = q.lt("next_followup", now.toISOString());
      } else {
        const until = new Date(now.getTime() + days * 86_400_000);
        q = q.gte("next_followup", now.toISOString()).lte("next_followup", until.toISOString());
      }
      const { data, error } = await q.order("next_followup", { ascending: true }).limit(100);
      if (error) return fail(error.message);
      return ok({ followups: data });
    }),
  );

  // ── Deals ────────────────────────────────────────────────────────────────

  server.registerTool(
    "search_deals",
    {
      title: "Search deals",
      description: "List deals, optionally filtered by text (name, company, contact) or stage. Includes days in stage and days to close.",
      inputSchema: {
        search: z.string().optional().describe("Matches deal name, company or contact name"),
        stage: z.enum(DEAL_STAGES).optional(),
        customer_id: id.optional(),
        sort_by: z.enum(["created_at", "value", "close_date", "probability", "name"]).default("created_at"),
        sort_order: z.enum(["asc", "desc"]).default("desc"),
        ...page,
      },
      annotations: READ,
    },
    safe(async ({ search, stage, customer_id, sort_by, sort_order, limit, offset }) => {
      let q = db.from("deals").select(DEAL_LIST, { count: "exact" }).eq("organization_id", orgId);
      if (search) q = q.or(`name.ilike.${like(search)},company.ilike.${like(search)},contact_name.ilike.${like(search)}`);
      if (stage) q = q.eq("stage", stage);
      if (customer_id) q = q.eq("customer_id", customer_id);
      const { data, count, error } = await q
        .order(sort_by, { ascending: sort_order === "asc", nullsFirst: false })
        .range(offset, offset + limit - 1);
      if (error) return fail(error.message);
      return ok({ total: count ?? 0, offset, deals: (data ?? []).map(withDealTiming) });
    }),
  );

  server.registerTool(
    "get_deal",
    {
      title: "Get deal",
      description: "Full deal record with notes and activity timeline.",
      inputSchema: { id },
      annotations: READ,
    },
    safe(async ({ id: dealId }) => {
      const { data: deal, error } = await db
        .from("deals")
        .select("*")
        .eq("organization_id", orgId)
        .eq("id", dealId)
        .maybeSingle();
      if (error) return fail(error.message);
      if (!deal) return fail("Deal not found");
      const [notes, activities] = await Promise.all([
        db.from("deal_notes").select("author_name, content, created_at").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(20),
        db.from("deal_activities").select("type, title, description, created_at").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(20),
      ]);
      // days_in_stage column is stale since 035; the computed value replaces it.
      return ok({ ...withDealTiming(deal), notes: notes.data, activities: activities.data });
    }),
  );

  // ── Customers ────────────────────────────────────────────────────────────

  server.registerTool(
    "search_customers",
    {
      title: "Search customers",
      description: "List customers, optionally filtered by text (name, email, company) or status.",
      inputSchema: {
        search: z.string().optional().describe("Matches first/last name, email or company"),
        status: z.enum(CUSTOMER_STATUSES).optional(),
        sort_by: z.enum(["created_at", "mrr", "health_score", "renewal_date", "last_name"]).default("created_at"),
        sort_order: z.enum(["asc", "desc"]).default("desc"),
        ...page,
      },
      annotations: READ,
    },
    safe(async ({ search, status, sort_by, sort_order, limit, offset }) => {
      let q = db.from("customers").select(CUSTOMER_LIST, { count: "exact" }).eq("organization_id", orgId);
      if (search) {
        const s = like(search);
        q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},company.ilike.${s}`);
      }
      if (status) q = q.eq("status", status);
      const { data, count, error } = await q
        .order(sort_by, { ascending: sort_order === "asc", nullsFirst: false })
        .range(offset, offset + limit - 1);
      if (error) return fail(error.message);
      return ok({ total: count ?? 0, offset, customers: data });
    }),
  );

  server.registerTool(
    "get_customer",
    {
      title: "Get customer",
      description: "Full customer record with notes, activity timeline, deals and contacts.",
      inputSchema: { id },
      annotations: READ,
    },
    safe(async ({ id: customerId }) => {
      const { data: customer, error } = await db
        .from("customers")
        .select("*")
        .eq("organization_id", orgId)
        .eq("id", customerId)
        .maybeSingle();
      if (error) return fail(error.message);
      if (!customer) return fail("Customer not found");
      const [notes, activities, deals, contacts] = await Promise.all([
        db.from("customer_notes").select("author_name, content, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(20),
        db.from("customer_activities").select("type, title, description, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(20),
        db.from("deals").select(DEAL_LIST).eq("organization_id", orgId).eq("customer_id", customerId),
        db.from("contacts").select(CONTACT_LIST).eq("organization_id", orgId).eq("customer_id", customerId),
      ]);
      return ok({
        ...customer,
        notes: notes.data,
        activities: activities.data,
        deals: (deals.data ?? []).map(withDealTiming),
        contacts: contacts.data,
      });
    }),
  );

  // ── Contacts ─────────────────────────────────────────────────────────────

  server.registerTool(
    "search_contacts",
    {
      title: "Search contacts",
      description: "List contacts (people at a lead or customer account), optionally by text or parent record.",
      inputSchema: {
        search: z.string().optional().describe("Matches name, email or title"),
        lead_id: id.optional(),
        customer_id: id.optional(),
        ...page,
      },
      annotations: READ,
    },
    safe(async ({ search, lead_id, customer_id, limit, offset }) => {
      let q = db.from("contacts").select(CONTACT_LIST, { count: "exact" }).eq("organization_id", orgId);
      if (search) q = q.or(`name.ilike.${like(search)},email.ilike.${like(search)},title.ilike.${like(search)}`);
      if (lead_id) q = q.eq("lead_id", lead_id);
      if (customer_id) q = q.eq("customer_id", customer_id);
      const { data, count, error } = await q.order("name").range(offset, offset + limit - 1);
      if (error) return fail(error.message);
      return ok({ total: count ?? 0, offset, contacts: data });
    }),
  );

  // ── Activities & calendar ────────────────────────────────────────────────

  server.registerTool(
    "list_activities",
    {
      title: "List activities and tasks",
      description:
        "Calls, meetings, tasks, emails and notes on the Activities page. Filter by type, status, date range or the record they relate to.",
      inputSchema: {
        type: z.enum(ACTIVITY_TYPES).optional(),
        status: z.enum(ACTIVITY_STATUSES).optional(),
        related_type: z.enum(RELATED_TYPES).optional(),
        related_id: id.optional(),
        from: isoDate.optional().describe("Earliest date, YYYY-MM-DD"),
        to: isoDate.optional().describe("Latest date, YYYY-MM-DD"),
        search: z.string().optional().describe("Matches title or description"),
        ...page,
      },
      annotations: READ,
    },
    safe(async ({ type, status, related_type, related_id, from, to, search, limit, offset }) => {
      let q = db
        .from("activities")
        .select("id, type, title, description, status, date, time, assignee, related_type, related_id, related_name", { count: "exact" })
        .eq("organization_id", orgId);
      if (type) q = q.eq("type", type);
      if (status) q = q.eq("status", status);
      if (related_type) q = q.eq("related_type", related_type);
      if (related_id) q = q.eq("related_id", related_id);
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      if (search) q = q.or(`title.ilike.${like(search)},description.ilike.${like(search)}`);
      const { data, count, error } = await q
        .order("date", { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);
      if (error) return fail(error.message);
      return ok({ total: count ?? 0, offset, activities: data });
    }),
  );

  server.registerTool(
    "list_calendar_events",
    {
      title: "List calendar events",
      description: "Calendar events between two dates (defaults to the next 14 days).",
      inputSchema: {
        from: isoDate.optional(),
        to: isoDate.optional(),
      },
      annotations: READ,
    },
    safe(async ({ from, to }) => {
      const today = new Date().toISOString().slice(0, 10);
      const start = from ?? today;
      const end = to ?? new Date(Date.parse(start) + 14 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await db
        .from("calendar_events")
        .select("id, title, description, date, start_time, end_time, type, status, related_type, related_id, related_name")
        .eq("organization_id", orgId)
        .gte("date", start)
        .lte("date", end)
        .order("date")
        .order("start_time", { nullsFirst: false })
        .limit(200);
      if (error) return fail(error.message);
      return ok({ from: start, to: end, events: data });
    }),
  );

  // ── Outreach ─────────────────────────────────────────────────────────────

  server.registerTool(
    "list_campaigns",
    {
      title: "List campaigns and sequences",
      description: "Email sequences and campaign runs with their send, open and reply counts.",
      inputSchema: { ...page },
      annotations: READ,
    },
    safe(async ({ limit, offset }) => {
      const [sequences, runs] = await Promise.all([
        db
          .from("sequences")
          .select("id, name, status, category, total_steps, total_enrolled, total_sent, total_opened, total_replied, total_bounced, open_rate, reply_rate, updated_at")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1),
        db
          .from("campaign_runs")
          .select("id, name, status, sequence_id, start_date, total_audience, total_enrolled, total_sent, total_opened, total_replied, total_bounced, updated_at")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1),
      ]);
      if (sequences.error) return fail(sequences.error.message);
      return ok({ sequences: sequences.data, campaign_runs: runs.data });
    }),
  );
}
