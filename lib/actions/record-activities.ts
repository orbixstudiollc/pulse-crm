"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";

// Activities shown on a lead / customer / deal page come from two places:
// the record's own *_activities table, and org-wide `activities` +
// `calendar_events` rows linked via related_type/related_id.

export type RecordKind = "lead" | "customer" | "deal";

export type LinkedItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  created_at: string;
  source: "activity" | "event";
};

const ACTIVITY_ROW_TYPES = new Set(["email", "call", "meeting", "note", "task", "deal", "invoice"]);

function isRecordKind(kind: unknown): kind is RecordKind {
  return kind === "lead" || kind === "customer" || kind === "deal";
}

const PARENT = {
  lead: { parentTable: "leads", table: "lead_activities", fk: "lead_id" },
  customer: { parentTable: "customers", table: "customer_activities", fk: "customer_id" },
  deal: { parentTable: "deals", table: "deal_activities", fk: "deal_id" },
} as const;

export async function deleteRecordActivity(kind: RecordKind, id: string) {
  if (!isRecordKind(kind) || !id) return { error: "Invalid activity" };

  const supabase = await createClient();
  const orgId = await getOrgId();
  const cfg = PARENT[kind];

  // Per-record activity tables have no organization_id: verify ownership
  // through the parent record before deleting.
  const { data: activity } = await supabase.from(cfg.table).select(cfg.fk).eq("id", id).maybeSingle();
  const parentId = (activity as Record<string, string> | null)?.[cfg.fk];
  if (!parentId) return { error: "Activity not found" };

  const { data: parent } = await supabase
    .from(cfg.parentTable)
    .select("id")
    .eq("id", parentId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!parent) return { error: "Activity not found" };

  const { error } = await supabase.from(cfg.table).delete().eq("id", id).eq(cfg.fk, parentId);
  if (error) return { error: error.message };

  return { success: true as const };
}

export async function getLinkedItems(kind: RecordKind, recordId: string) {
  if (!isRecordKind(kind) || !recordId) return { error: "Invalid record", data: [] as LinkedItem[] };

  const supabase = await createClient();
  const orgId = await getOrgId();

  const [activitiesRes, eventsRes] = await Promise.all([
    supabase
      .from("activities")
      .select("id, type, title, description, created_at")
      .eq("organization_id", orgId)
      .eq("related_type", kind)
      .eq("related_id", recordId),
    supabase
      .from("calendar_events")
      .select("id, type, title, description, created_at")
      .eq("organization_id", orgId)
      .eq("related_type", kind)
      .eq("related_id", recordId),
  ]);

  const error = activitiesRes.error?.message ?? eventsRes.error?.message;
  if (error) return { error, data: [] as LinkedItem[] };

  const items: LinkedItem[] = [
    ...(activitiesRes.data ?? []).map((a) => ({ ...a, source: "activity" as const })),
    ...(eventsRes.data ?? []).map((e) => ({
      ...e,
      type: ACTIVITY_ROW_TYPES.has(e.type) ? e.type : "meeting",
      source: "event" as const,
    })),
  ];

  return { data: items };
}
