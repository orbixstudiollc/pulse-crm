import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Database } from "@/types/database";
import {
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  CUSTOMER_PLANS,
  CUSTOMER_STATUSES,
  DEAL_STAGES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  RELATED_TYPES,
  authorName,
  belongsToOrg,
  definedOnly,
  fail,
  id,
  isoDate,
  ok,
  relatedName,
  safe,
  type ToolEnv,
} from "./shared";

type Tables = Database["public"]["Tables"];

const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const UPDATE = { ...WRITE, idempotentHint: true } as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

// Optional-everything field sets; create tools mark the required ones.
const leadFields = {
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  title: z.string().optional().describe("Job title"),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  employees: z.string().optional().describe("Company size, e.g. 11-50"),
  status: z.enum(LEAD_STATUSES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  estimated_value: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
  pain_points: z.string().optional(),
  personal_note: z.string().optional(),
};

const dealFields = {
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  value: z.number().min(0).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  stage: z.enum(DEAL_STAGES).optional(),
  close_date: isoDate.optional().describe("Expected close date, YYYY-MM-DD"),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  customer_id: id.optional().describe("Customer this deal belongs to"),
  notes: z.string().optional(),
};

const customerFields = {
  first_name: z.string().min(1).optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  status: z.enum(CUSTOMER_STATUSES).optional(),
  plan: z.enum(CUSTOMER_PLANS).optional(),
  mrr: z.number().min(0).optional().describe("Monthly recurring revenue"),
  health_score: z.number().int().min(0).max(100).optional(),
  renewal_date: isoDate.optional(),
  country: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
};

const contactFields = {
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  buying_role: z
    .enum(["economic_buyer", "champion", "technical_evaluator", "end_user", "blocker", "coach"])
    .optional(),
  influence_level: z.enum(["high", "medium", "low"]).optional(),
  notes: z.string().optional(),
  lead_id: id.optional().describe("Lead account this person belongs to"),
  customer_id: id.optional().describe("Customer account this person belongs to"),
};

const activityFields = {
  type: z.enum(ACTIVITY_TYPES).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(ACTIVITY_STATUSES).optional(),
  date: isoDate.optional(),
  time: z.string().optional().describe("Time of day, e.g. 14:30"),
  assignee: z.string().optional(),
  related_type: z.enum(RELATED_TYPES).optional(),
  related_id: id.optional().describe("Lead, deal or customer id (with related_type)"),
};

// Input shapes, shared by the MCP registration and the toPatch mappers below.
const WRITE_INPUTS = {
  create_lead: { ...leadFields, name: z.string().min(1), email: z.string().email() },
  update_lead: { id, ...leadFields },
  set_followup: {
    lead_id: id,
    due: z.string().optional().describe("ISO date or datetime, e.g. 2026-10-08 or 2026-10-08T09:00:00Z"),
    note: z.string().optional(),
    clear: z.boolean().default(false),
  },
  convert_lead_to_customer: { lead_id: id },
  create_deal: { ...dealFields, name: z.string().min(1) },
  update_deal: { id, ...dealFields },
  create_customer: { ...customerFields, first_name: z.string().min(1), email: z.string().email() },
  update_customer: { id, ...customerFields },
  create_contact: { ...contactFields, name: z.string().min(1) },
  update_contact: { id, ...contactFields },
  create_activity: { ...activityFields, type: z.enum(ACTIVITY_TYPES), title: z.string().min(1) },
  update_activity: { id, ...activityFields },
  create_calendar_event: {
    title: z.string().min(1),
    date: isoDate,
    start_time: z.string().optional().describe("e.g. 14:30"),
    end_time: z.string().optional().describe("e.g. 15:00"),
    description: z.string().optional(),
    type: z.enum(["meeting", "call", "task", "reminder"]).default("meeting"),
    related_type: z.enum(RELATED_TYPES).optional(),
    related_id: id.optional(),
  },
  add_note: {
    record_type: z.enum(RELATED_TYPES),
    record_id: id,
    content: z.string().min(1),
  },
};

type WriteInput<K extends keyof typeof WRITE_INPUTS> = z.infer<z.ZodObject<(typeof WRITE_INPUTS)[K]>>;

/**
 * Write-tool env. The two optional fields are set only by the Copilot adapter
 * (lib/ai/tools/registry.ts); MCP clients never set them, so their behaviour is unchanged.
 */
export interface WriteToolEnv extends ToolEnv {
  /** Copilot-origin writes: automation rules skip outbound actions; skipped action types are collected here. */
  automation?: { origin: "copilot"; skipped: string[] };
  /** Stale-write guard: updates only apply while the row's updated_at still equals this value. */
  expectUpdatedAt?: string;
}

/** Error text a guarded update returns when the row changed (or vanished) since its diff was shown. */
export const RECORD_CHANGED = "record_changed";

export type WriteTable =
  | "leads"
  | "deals"
  | "customers"
  | "contacts"
  | "activities"
  | "calendar_events"
  | "lead_notes"
  | "deal_notes"
  | "customer_notes";

/** The exact column patch a write tool's handler writes (before workspace/author columns are added). */
export interface WritePatch {
  table: WriteTable;
  /** Row id for updates; absent for inserts. */
  id?: string;
  patch: Record<string, unknown>;
}

function isValidDue(due: string | undefined): due is string {
  return !!due && !Number.isNaN(Date.parse(due));
}

/**
 * toPatch per write tool: the single place that maps tool input to DB columns.
 * Handlers apply exactly this patch (plus workspace/author/derived columns), and the
 * Copilot approval card diffs exactly this patch, so the card shows what will be written.
 */
export const WRITE_PATCHES = {
  create_lead: (input: WriteInput<"create_lead">): WritePatch => ({ table: "leads", patch: definedOnly(input) }),
  update_lead: ({ id: leadId, ...fields }: WriteInput<"update_lead">): WritePatch => ({
    table: "leads",
    id: leadId,
    patch: definedOnly(fields),
  }),
  set_followup: ({ lead_id, due, note, clear }: WriteInput<"set_followup">): WritePatch => ({
    table: "leads",
    id: lead_id,
    patch: clear
      ? { next_followup: null, followup_note: null }
      : { next_followup: isValidDue(due) ? new Date(due).toISOString() : null, followup_note: note ?? null },
  }),
  convert_lead_to_customer: ({ lead_id }: WriteInput<"convert_lead_to_customer">): WritePatch => ({
    table: "leads",
    id: lead_id,
    patch: { converted_at: new Date().toISOString() },
  }),
  create_deal: (input: WriteInput<"create_deal">): WritePatch => ({
    table: "deals",
    patch: { ...definedOnly(input), stage: input.stage ?? "discovery" },
  }),
  update_deal: ({ id: dealId, ...fields }: WriteInput<"update_deal">): WritePatch => ({
    table: "deals",
    id: dealId,
    patch: definedOnly(fields),
  }),
  create_customer: (input: WriteInput<"create_customer">): WritePatch => ({
    table: "customers",
    patch: { last_name: "", ...definedOnly(input) },
  }),
  update_customer: ({ id: customerId, ...fields }: WriteInput<"update_customer">): WritePatch => ({
    table: "customers",
    id: customerId,
    patch: definedOnly(fields),
  }),
  create_contact: (input: WriteInput<"create_contact">): WritePatch => ({
    table: "contacts",
    patch: { buying_role: "end_user", influence_level: "medium", ...definedOnly(input) },
  }),
  update_contact: ({ id: contactId, ...fields }: WriteInput<"update_contact">): WritePatch => ({
    table: "contacts",
    id: contactId,
    patch: definedOnly(fields),
  }),
  create_activity: (input: WriteInput<"create_activity">): WritePatch => ({
    table: "activities",
    patch: {
      status: input.type === "task" ? "pending" : "completed",
      date: new Date().toISOString().slice(0, 10),
      ...definedOnly(input),
    },
  }),
  update_activity: ({ id: activityId, ...fields }: WriteInput<"update_activity">): WritePatch => ({
    table: "activities",
    id: activityId,
    patch: definedOnly(fields),
  }),
  create_calendar_event: (input: WriteInput<"create_calendar_event">): WritePatch => ({
    table: "calendar_events",
    patch: { ...definedOnly(input), status: "scheduled" },
  }),
  add_note: ({ record_type, record_id, content }: WriteInput<"add_note">): WritePatch =>
    record_type === "lead"
      ? { table: "lead_notes", patch: { lead_id: record_id, content } }
      : record_type === "deal"
        ? { table: "deal_notes", patch: { deal_id: record_id, content } }
        : { table: "customer_notes", patch: { customer_id: record_id, content } },
};

export type PatchedWriteTool = keyof typeof WRITE_PATCHES;

const RECORD_TABLES = {
  lead: "leads",
  deal: "deals",
  customer: "customers",
  contact: "contacts",
  activity: "activities",
  calendar_event: "calendar_events",
} as const;

export function registerWriteTools(server: McpServer, env: WriteToolEnv) {
  const { db, ctx } = env;
  const orgId = ctx.orgId;

  /** Rejects a customer/lead/related reference that is not in this workspace. */
  async function checkRefs(refs: {
    customer_id?: string;
    lead_id?: string;
    related_type?: (typeof RELATED_TYPES)[number];
    related_id?: string;
  }): Promise<{ error?: string; related_name?: string }> {
    if (refs.customer_id && !(await belongsToOrg(env, "customers", refs.customer_id))) {
      return { error: "customer_id not found in this workspace" };
    }
    if (refs.lead_id && !(await belongsToOrg(env, "leads", refs.lead_id))) {
      return { error: "lead_id not found in this workspace" };
    }
    if (refs.related_id || refs.related_type) {
      if (!refs.related_id || !refs.related_type) return { error: "related_type and related_id go together" };
      const name = await relatedName(env, refs.related_type, refs.related_id);
      if (!name) return { error: `${refs.related_type} ${refs.related_id} not found in this workspace` };
      return { related_name: name };
    }
    return {};
  }

  function fireLeadRules(leadId: string, trigger: "lead_created" | "lead_updated", changed?: string[]) {
    // Same automation hook the Leads page fires (lib/actions/leads.ts).
    const eventData = changed ? { changed_fields: changed } : {};
    const origin = env.automation?.origin;
    return import("@/lib/automation/runner")
      .then(({ evaluateLeadAgainstRules }) =>
        origin
          ? evaluateLeadAgainstRules(leadId, trigger, eventData, { origin })
          : evaluateLeadAgainstRules(leadId, trigger, eventData),
      )
      .then((outcome) => {
        if (env.automation && outcome) env.automation.skipped.push(...outcome.skipped);
      })
      .catch(() => undefined);
  }

  /** Not-found text, or record_changed when the Copilot stale-write guard is on. */
  function missing(label: string): string {
    return env.expectUpdatedAt ? RECORD_CHANGED : label;
  }

  // ── Leads ────────────────────────────────────────────────────────────────

  server.registerTool(
    "create_lead",
    {
      title: "Create lead",
      description: "Add a lead. Runs the workspace's lead_created automation rules.",
      inputSchema: WRITE_INPUTS.create_lead,
      annotations: WRITE,
    },
    safe(async (input) => {
      const { patch } = WRITE_PATCHES.create_lead(input);
      const { data, error } = await db
        .from("leads")
        .insert({ ...patch, organization_id: orgId, created_by: ctx.createdBy } as Tables["leads"]["Insert"])
        .select()
        .single();
      if (error) return fail(error.message);
      await fireLeadRules(data.id, "lead_created");
      return ok({ created: data });
    }),
  );

  server.registerTool(
    "update_lead",
    {
      title: "Update lead",
      description: "Change fields on a lead. Only the fields you pass are changed. Runs lead_updated automation rules.",
      inputSchema: WRITE_INPUTS.update_lead,
      annotations: UPDATE,
    },
    safe(async (input) => {
      const patch: Record<string, unknown> = { ...WRITE_PATCHES.update_lead(input).patch };
      const changed = Object.keys(patch);
      if (changed.length === 0) return fail("Nothing to update");
      if (input.status) {
        const { data: current } = await db
          .from("leads")
          .select("status")
          .eq("organization_id", orgId)
          .eq("id", input.id)
          .maybeSingle();
        if (!current) return fail(missing("Lead not found"));
        // Restart the days-in-status clock only on a real status change (as the automation
        // runner does), so days_in_status rules cannot fire right after this change.
        if (input.status !== current.status) patch.status_changed_at = new Date().toISOString();
      }
      let q = db
        .from("leads")
        .update(patch as Tables["leads"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", input.id);
      if (env.expectUpdatedAt) q = q.eq("updated_at", env.expectUpdatedAt);
      const { data, error } = await q.select().maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail(missing("Lead not found"));
      await fireLeadRules(input.id, "lead_updated", changed);
      return ok({ updated: data });
    }),
  );

  server.registerTool(
    "set_followup",
    {
      title: "Set or clear a follow-up",
      description: "Schedule the next follow-up on a lead, or clear it by passing clear: true.",
      inputSchema: WRITE_INPUTS.set_followup,
      annotations: UPDATE,
    },
    safe(async (input) => {
      if (!input.clear && !isValidDue(input.due)) return fail("Pass a valid due date, or clear: true");
      const { patch } = WRITE_PATCHES.set_followup(input);
      let q = db
        .from("leads")
        .update(patch as Tables["leads"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", input.lead_id);
      if (env.expectUpdatedAt) q = q.eq("updated_at", env.expectUpdatedAt);
      const { data, error } = await q.select("id, name, next_followup, followup_note").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail(missing("Lead not found"));
      return ok({ updated: data });
    }),
  );

  server.registerTool(
    "convert_lead_to_customer",
    {
      title: "Convert lead to customer",
      description:
        "Create a customer from a lead (same as Convert on the Leads page). The lead is kept, marked converted and hidden from search_leads.",
      inputSchema: WRITE_INPUTS.convert_lead_to_customer,
      annotations: WRITE,
    },
    safe(async (input) => {
      const { lead_id } = input;
      const { data: lead } = await db
        .from("leads")
        .select("*")
        .eq("organization_id", orgId)
        .eq("id", lead_id)
        .maybeSingle();
      if (!lead) return fail(missing("Lead not found"));
      if (env.expectUpdatedAt && lead.updated_at !== env.expectUpdatedAt) return fail(RECORD_CHANGED);
      if (lead.converted_at) return fail("This lead has already been converted");
      const [firstName, ...rest] = (lead.name || "").split(" ");
      const { data: customer, error } = await db
        .from("customers")
        .insert({
          organization_id: orgId,
          created_by: ctx.createdBy,
          first_name: firstName || "",
          last_name: rest.join(" "),
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          website: lead.website,
          industry: lead.industry,
          status: "active",
          plan: "free",
        })
        .select()
        .single();
      if (error) return fail(error.message);
      // Keep the lead and its history and stamp it, as convertLeadToCustomer does (037). The
      // stamp only lands while the lead is still unconverted (and, for the Copilot, unchanged
      // since its diff was shown): of two concurrent conversions only one keeps its customer.
      let mark = db
        .from("leads")
        .update({
          ...WRITE_PATCHES.convert_lead_to_customer(input).patch,
          converted_customer_id: customer.id,
        } as Tables["leads"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", lead_id)
        .is("converted_at", null);
      if (env.expectUpdatedAt) mark = mark.eq("updated_at", env.expectUpdatedAt);
      const { data: marked, error: markError } = await mark.select("id").maybeSingle();
      if (markError || !marked) {
        await db.from("customers").delete().eq("organization_id", orgId).eq("id", customer.id);
        if (markError) return fail(markError.message);
        return fail(env.expectUpdatedAt ? RECORD_CHANGED : "This lead has already been converted");
      }
      return ok({ customer });
    }),
  );

  // ── Deals ────────────────────────────────────────────────────────────────

  server.registerTool(
    "create_deal",
    {
      title: "Create deal",
      description: "Add a deal to the pipeline. Stage defaults to discovery.",
      inputSchema: WRITE_INPUTS.create_deal,
      annotations: WRITE,
    },
    safe(async (input) => {
      const refs = await checkRefs({ customer_id: input.customer_id });
      if (refs.error) return fail(refs.error);
      const { data, error } = await db
        .from("deals")
        .insert({
          ...WRITE_PATCHES.create_deal(input).patch,
          stage_changed_at: new Date().toISOString(),
          organization_id: orgId,
          created_by: ctx.createdBy,
          owner_id: ctx.createdBy,
        } as Tables["deals"]["Insert"])
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ created: data });
    }),
  );

  server.registerTool(
    "update_deal",
    {
      title: "Update deal",
      description: "Change fields on a deal, including moving it to another stage. Only the fields you pass are changed.",
      inputSchema: WRITE_INPUTS.update_deal,
      annotations: UPDATE,
    },
    safe(async (input) => {
      const dealId = input.id;
      const patch: Record<string, unknown> = { ...WRITE_PATCHES.update_deal(input).patch };
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      const refs = await checkRefs({ customer_id: input.customer_id });
      if (refs.error) return fail(refs.error);
      const { data: current } = await db
        .from("deals")
        .select("stage")
        .eq("organization_id", orgId)
        .eq("id", dealId)
        .maybeSingle();
      if (!current) return fail(missing("Deal not found"));
      // Restart the days-in-stage clock only on a real stage change (as updateDeal does).
      const stageChanged = !!input.stage && input.stage !== current.stage;
      if (stageChanged) patch.stage_changed_at = new Date().toISOString();
      let q = db
        .from("deals")
        .update(patch as Tables["deals"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", dealId);
      if (env.expectUpdatedAt) q = q.eq("updated_at", env.expectUpdatedAt);
      const { data, error } = await q.select().maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail(missing("Deal not found"));
      if (stageChanged && input.stage) {
        await db.from("deal_activities").insert({
          deal_id: dealId,
          type: "deal",
          title: `Stage changed to ${input.stage.replace(/_/g, " ")}`,
          description: `Moved from ${current.stage.replace(/_/g, " ")} by AI assistant`,
        });
      }
      return ok({ updated: data });
    }),
  );

  // ── Customers ────────────────────────────────────────────────────────────

  server.registerTool(
    "create_customer",
    {
      title: "Create customer",
      description: "Add a customer account.",
      inputSchema: WRITE_INPUTS.create_customer,
      annotations: WRITE,
    },
    safe(async (input) => {
      const { data, error } = await db
        .from("customers")
        .insert({
          ...WRITE_PATCHES.create_customer(input).patch,
          organization_id: orgId,
          created_by: ctx.createdBy,
        } as Tables["customers"]["Insert"])
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ created: data });
    }),
  );

  server.registerTool(
    "update_customer",
    {
      title: "Update customer",
      description: "Change fields on a customer. Only the fields you pass are changed.",
      inputSchema: WRITE_INPUTS.update_customer,
      annotations: UPDATE,
    },
    safe(async (input) => {
      const { patch } = WRITE_PATCHES.update_customer(input);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      let q = db
        .from("customers")
        .update(patch as Tables["customers"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", input.id);
      if (env.expectUpdatedAt) q = q.eq("updated_at", env.expectUpdatedAt);
      const { data, error } = await q.select().maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail(missing("Customer not found"));
      return ok({ updated: data });
    }),
  );

  // ── Contacts ─────────────────────────────────────────────────────────────

  server.registerTool(
    "create_contact",
    {
      title: "Create contact",
      description: "Add a person, usually linked to a lead or customer account.",
      inputSchema: WRITE_INPUTS.create_contact,
      annotations: WRITE,
    },
    safe(async (input) => {
      const refs = await checkRefs({ customer_id: input.customer_id, lead_id: input.lead_id });
      if (refs.error) return fail(refs.error);
      const { data, error } = await db
        .from("contacts")
        .insert({
          ...WRITE_PATCHES.create_contact(input).patch,
          organization_id: orgId,
        } as Tables["contacts"]["Insert"])
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ created: data });
    }),
  );

  server.registerTool(
    "update_contact",
    {
      title: "Update contact",
      description: "Change fields on a contact. Only the fields you pass are changed.",
      inputSchema: WRITE_INPUTS.update_contact,
      annotations: UPDATE,
    },
    safe(async (input) => {
      const { patch } = WRITE_PATCHES.update_contact(input);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      const refs = await checkRefs({ customer_id: input.customer_id, lead_id: input.lead_id });
      if (refs.error) return fail(refs.error);
      let q = db
        .from("contacts")
        .update(patch as Tables["contacts"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", input.id);
      if (env.expectUpdatedAt) q = q.eq("updated_at", env.expectUpdatedAt);
      const { data, error } = await q.select().maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail(missing("Contact not found"));
      return ok({ updated: data });
    }),
  );

  // ── Activities, tasks & calendar ─────────────────────────────────────────

  server.registerTool(
    "create_activity",
    {
      title: "Create activity or task",
      description:
        "Log a call, meeting, email or note, or create a task. Link it to a lead, deal or customer with related_type + related_id.",
      inputSchema: WRITE_INPUTS.create_activity,
      annotations: WRITE,
    },
    safe(async (input) => {
      const refs = await checkRefs({ related_type: input.related_type, related_id: input.related_id });
      if (refs.error) return fail(refs.error);
      const { data, error } = await db
        .from("activities")
        .insert({
          ...WRITE_PATCHES.create_activity(input).patch,
          related_name: refs.related_name ?? null,
          organization_id: orgId,
          created_by: ctx.createdBy,
        } as Tables["activities"]["Insert"])
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ created: data });
    }),
  );

  server.registerTool(
    "update_activity",
    {
      title: "Update activity or task",
      description: "Change an activity, e.g. mark a task completed with status: completed.",
      inputSchema: WRITE_INPUTS.update_activity,
      annotations: UPDATE,
    },
    safe(async (input) => {
      const patch: Record<string, unknown> = { ...WRITE_PATCHES.update_activity(input).patch };
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      if (input.related_id || input.related_type) {
        const refs = await checkRefs({ related_type: input.related_type, related_id: input.related_id });
        if (refs.error) return fail(refs.error);
        patch.related_name = refs.related_name;
      }
      let q = db
        .from("activities")
        .update(patch as Tables["activities"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", input.id);
      if (env.expectUpdatedAt) q = q.eq("updated_at", env.expectUpdatedAt);
      const { data, error } = await q.select().maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail(missing("Activity not found"));
      return ok({ updated: data });
    }),
  );

  server.registerTool(
    "create_calendar_event",
    {
      title: "Create calendar event",
      description: "Put an event on the Pulse calendar (not an external calendar). Optionally link it to a lead, deal or customer.",
      inputSchema: WRITE_INPUTS.create_calendar_event,
      annotations: WRITE,
    },
    safe(async (input) => {
      const refs = await checkRefs({ related_type: input.related_type, related_id: input.related_id });
      if (refs.error) return fail(refs.error);
      const { data, error } = await db
        .from("calendar_events")
        .insert({
          ...WRITE_PATCHES.create_calendar_event(input).patch,
          related_name: refs.related_name ?? null,
          organization_id: orgId,
          created_by: ctx.createdBy,
        } as Tables["calendar_events"]["Insert"])
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ created: data });
    }),
  );

  // ── Notes ────────────────────────────────────────────────────────────────

  server.registerTool(
    "add_note",
    {
      title: "Add note",
      description: "Add a note to a lead, deal or customer timeline.",
      inputSchema: WRITE_INPUTS.add_note,
      annotations: WRITE,
    },
    safe(async (input) => {
      const { record_type, record_id } = input;
      if (!(await relatedName(env, record_type, record_id))) return fail(`${record_type} not found`);
      const author_name = await authorName(env);
      const author_id = ctx.createdBy;
      const row = { ...WRITE_PATCHES.add_note(input).patch, author_id, author_name };
      const result =
        record_type === "lead"
          ? await db.from("lead_notes").insert(row as Tables["lead_notes"]["Insert"]).select().single()
          : record_type === "deal"
            ? await db.from("deal_notes").insert(row as Tables["deal_notes"]["Insert"]).select().single()
            : await db.from("customer_notes").insert(row as Tables["customer_notes"]["Insert"]).select().single();
      if (result.error) return fail(result.error.message);
      return ok({ created: result.data });
    }),
  );

  // ── Delete ───────────────────────────────────────────────────────────────

  server.registerTool(
    "delete_record",
    {
      title: "Delete record",
      description:
        "Permanently delete a lead, deal, customer, contact, activity or calendar event. Cannot be undone; confirm with the user first.",
      inputSchema: {
        record_type: z.enum(Object.keys(RECORD_TABLES) as [keyof typeof RECORD_TABLES, ...(keyof typeof RECORD_TABLES)[]]),
        id,
      },
      annotations: DESTRUCTIVE,
    },
    safe(async ({ record_type, id: recordId }) => {
      const { data, error } = await db
        .from(RECORD_TABLES[record_type])
        .delete()
        .eq("organization_id", orgId)
        .eq("id", recordId)
        .select("id");
      if (error) return fail(error.message);
      if (!data?.length) return fail(`${record_type} not found`);
      return ok({ deleted: { record_type, id: recordId } });
    }),
  );
}
