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

const RECORD_TABLES = {
  lead: "leads",
  deal: "deals",
  customer: "customers",
  contact: "contacts",
  activity: "activities",
  calendar_event: "calendar_events",
} as const;

export function registerWriteTools(server: McpServer, env: ToolEnv) {
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
    return import("@/lib/automation/runner")
      .then(({ evaluateLeadAgainstRules }) =>
        evaluateLeadAgainstRules(leadId, trigger, changed ? { changed_fields: changed } : {}),
      )
      .catch(() => undefined);
  }

  // ── Leads ────────────────────────────────────────────────────────────────

  server.registerTool(
    "create_lead",
    {
      title: "Create lead",
      description: "Add a lead. Runs the workspace's lead_created automation rules.",
      inputSchema: { ...leadFields, name: z.string().min(1), email: z.string().email() },
      annotations: WRITE,
    },
    safe(async (input) => {
      const { data, error } = await db
        .from("leads")
        .insert({ ...definedOnly(input), organization_id: orgId, created_by: ctx.createdBy } as Tables["leads"]["Insert"])
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
      inputSchema: { id, ...leadFields },
      annotations: UPDATE,
    },
    safe(async ({ id: leadId, ...fields }) => {
      const patch = definedOnly(fields);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      const { data, error } = await db
        .from("leads")
        .update(patch as Tables["leads"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", leadId)
        .select()
        .maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Lead not found");
      await fireLeadRules(leadId, "lead_updated", Object.keys(patch));
      return ok({ updated: data });
    }),
  );

  server.registerTool(
    "set_followup",
    {
      title: "Set or clear a follow-up",
      description: "Schedule the next follow-up on a lead, or clear it by passing clear: true.",
      inputSchema: {
        lead_id: id,
        due: z.string().optional().describe("ISO date or datetime, e.g. 2026-10-08 or 2026-10-08T09:00:00Z"),
        note: z.string().optional(),
        clear: z.boolean().default(false),
      },
      annotations: UPDATE,
    },
    safe(async ({ lead_id, due, note, clear }) => {
      if (!clear && (!due || Number.isNaN(Date.parse(due)))) return fail("Pass a valid due date, or clear: true");
      const patch = clear
        ? { next_followup: null, followup_note: null }
        : { next_followup: new Date(due!).toISOString(), followup_note: note ?? null };
      const { data, error } = await db
        .from("leads")
        .update(patch)
        .eq("organization_id", orgId)
        .eq("id", lead_id)
        .select("id, name, next_followup, followup_note")
        .maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Lead not found");
      return ok({ updated: data });
    }),
  );

  server.registerTool(
    "convert_lead_to_customer",
    {
      title: "Convert lead to customer",
      description: "Create a customer from a lead and delete the lead (same as Convert on the Leads page).",
      inputSchema: { lead_id: id },
      annotations: DESTRUCTIVE,
    },
    safe(async ({ lead_id }) => {
      const { data: lead } = await db
        .from("leads")
        .select("*")
        .eq("organization_id", orgId)
        .eq("id", lead_id)
        .maybeSingle();
      if (!lead) return fail("Lead not found");
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
      // Keep the people: re-point the lead's contacts at the new customer.
      await db.from("contacts").update({ customer_id: customer.id, lead_id: null }).eq("organization_id", orgId).eq("lead_id", lead_id);
      await db.from("leads").delete().eq("organization_id", orgId).eq("id", lead_id);
      return ok({ customer });
    }),
  );

  // ── Deals ────────────────────────────────────────────────────────────────

  server.registerTool(
    "create_deal",
    {
      title: "Create deal",
      description: "Add a deal to the pipeline. Stage defaults to discovery.",
      inputSchema: { ...dealFields, name: z.string().min(1) },
      annotations: WRITE,
    },
    safe(async (input) => {
      const refs = await checkRefs({ customer_id: input.customer_id });
      if (refs.error) return fail(refs.error);
      const { data, error } = await db
        .from("deals")
        .insert({
          ...definedOnly(input),
          stage: input.stage ?? "discovery",
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
      inputSchema: { id, ...dealFields },
      annotations: UPDATE,
    },
    safe(async ({ id: dealId, ...fields }) => {
      const patch: Record<string, unknown> = definedOnly(fields);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      const refs = await checkRefs({ customer_id: fields.customer_id });
      if (refs.error) return fail(refs.error);
      const { data: current } = await db
        .from("deals")
        .select("stage")
        .eq("organization_id", orgId)
        .eq("id", dealId)
        .maybeSingle();
      if (!current) return fail("Deal not found");
      // Restart the days-in-stage clock only on a real stage change (as updateDeal does).
      if (fields.stage && fields.stage !== current.stage) patch.stage_changed_at = new Date().toISOString();
      const { data, error } = await db
        .from("deals")
        .update(patch as Tables["deals"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", dealId)
        .select()
        .single();
      if (error) return fail(error.message);
      if (fields.stage && fields.stage !== current.stage) {
        await db.from("deal_activities").insert({
          deal_id: dealId,
          type: "deal",
          title: `Stage changed to ${fields.stage.replace(/_/g, " ")}`,
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
      inputSchema: { ...customerFields, first_name: z.string().min(1), email: z.string().email() },
      annotations: WRITE,
    },
    safe(async (input) => {
      const { data, error } = await db
        .from("customers")
        .insert({
          last_name: "",
          ...definedOnly(input),
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
      inputSchema: { id, ...customerFields },
      annotations: UPDATE,
    },
    safe(async ({ id: customerId, ...fields }) => {
      const patch = definedOnly(fields);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      const { data, error } = await db
        .from("customers")
        .update(patch as Tables["customers"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", customerId)
        .select()
        .maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Customer not found");
      return ok({ updated: data });
    }),
  );

  // ── Contacts ─────────────────────────────────────────────────────────────

  server.registerTool(
    "create_contact",
    {
      title: "Create contact",
      description: "Add a person, usually linked to a lead or customer account.",
      inputSchema: { ...contactFields, name: z.string().min(1) },
      annotations: WRITE,
    },
    safe(async (input) => {
      const refs = await checkRefs({ customer_id: input.customer_id, lead_id: input.lead_id });
      if (refs.error) return fail(refs.error);
      const { data, error } = await db
        .from("contacts")
        .insert({
          buying_role: "end_user",
          influence_level: "medium",
          ...definedOnly(input),
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
      inputSchema: { id, ...contactFields },
      annotations: UPDATE,
    },
    safe(async ({ id: contactId, ...fields }) => {
      const patch = definedOnly(fields);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      const refs = await checkRefs({ customer_id: fields.customer_id, lead_id: fields.lead_id });
      if (refs.error) return fail(refs.error);
      const { data, error } = await db
        .from("contacts")
        .update(patch as Tables["contacts"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", contactId)
        .select()
        .maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Contact not found");
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
      inputSchema: {
        ...activityFields,
        type: z.enum(ACTIVITY_TYPES),
        title: z.string().min(1),
      },
      annotations: WRITE,
    },
    safe(async (input) => {
      const refs = await checkRefs({ related_type: input.related_type, related_id: input.related_id });
      if (refs.error) return fail(refs.error);
      const { data, error } = await db
        .from("activities")
        .insert({
          status: input.type === "task" ? "pending" : "completed",
          date: new Date().toISOString().slice(0, 10),
          ...definedOnly(input),
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
      inputSchema: { id, ...activityFields },
      annotations: UPDATE,
    },
    safe(async ({ id: activityId, ...fields }) => {
      const patch: Record<string, unknown> = definedOnly(fields);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      if (fields.related_id || fields.related_type) {
        const refs = await checkRefs({ related_type: fields.related_type, related_id: fields.related_id });
        if (refs.error) return fail(refs.error);
        patch.related_name = refs.related_name;
      }
      const { data, error } = await db
        .from("activities")
        .update(patch as Tables["activities"]["Update"])
        .eq("organization_id", orgId)
        .eq("id", activityId)
        .select()
        .maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Activity not found");
      return ok({ updated: data });
    }),
  );

  server.registerTool(
    "create_calendar_event",
    {
      title: "Create calendar event",
      description: "Put an event on the Pulse calendar (not an external calendar). Optionally link it to a lead, deal or customer.",
      inputSchema: {
        title: z.string().min(1),
        date: isoDate,
        start_time: z.string().optional().describe("e.g. 14:30"),
        end_time: z.string().optional().describe("e.g. 15:00"),
        description: z.string().optional(),
        type: z.enum(["meeting", "call", "task", "reminder"]).default("meeting"),
        related_type: z.enum(RELATED_TYPES).optional(),
        related_id: id.optional(),
      },
      annotations: WRITE,
    },
    safe(async (input) => {
      const refs = await checkRefs({ related_type: input.related_type, related_id: input.related_id });
      if (refs.error) return fail(refs.error);
      const { data, error } = await db
        .from("calendar_events")
        .insert({
          ...definedOnly(input),
          related_name: refs.related_name ?? null,
          status: "scheduled",
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
      inputSchema: {
        record_type: z.enum(RELATED_TYPES),
        record_id: id,
        content: z.string().min(1),
      },
      annotations: WRITE,
    },
    safe(async ({ record_type, record_id, content }) => {
      if (!(await relatedName(env, record_type, record_id))) return fail(`${record_type} not found`);
      const author_name = await authorName(env);
      const author_id = ctx.createdBy;
      const result =
        record_type === "lead"
          ? await db.from("lead_notes").insert({ lead_id: record_id, author_id, author_name, content }).select().single()
          : record_type === "deal"
            ? await db.from("deal_notes").insert({ deal_id: record_id, author_id, author_name, content }).select().single()
            : await db.from("customer_notes").insert({ customer_id: record_id, author_id, author_name, content }).select().single();
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
