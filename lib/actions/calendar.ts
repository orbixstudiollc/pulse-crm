"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type CalendarEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type CalendarEventUpdate = Database["public"]["Tables"]["calendar_events"]["Update"];

// Only these columns exist on calendar_events; any other key would fail the whole write.
const CALENDAR_EVENT_COLUMNS = [
  "id",
  "organization_id",
  "created_by",
  "title",
  "description",
  "date",
  "start_time",
  "end_time",
  "type",
  "status",
  "related_type",
  "related_name",
  "related_id",
] as const;

// Updates must never rewrite identity or ownership columns.
const CALENDAR_EVENT_UPDATE_COLUMNS = CALENDAR_EVENT_COLUMNS.filter(
  (c) => c !== "id" && c !== "organization_id" && c !== "created_by",
);

function pickColumns(data: Record<string, unknown>, allowed: readonly string[]) {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => allowed.includes(key)),
  );
}

function pickCalendarColumns(data: Record<string, unknown>) {
  return pickColumns(data, CALENDAR_EVENT_COLUMNS);
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getCalendarEvents(month: number, year: number) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Build date range for the month (include surrounding days for calendar grid)
  const startDate = new Date(year, month - 1, 1);
  startDate.setDate(startDate.getDate() - 7); // week before
  const endDate = new Date(year, month, 0);
  endDate.setDate(endDate.getDate() + 7); // week after

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("organization_id", orgId)
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getCalendarEventById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

// Every open event (null status counts as open) on or after fromDate
// ('YYYY-MM-DD'). The default is yesterday in UTC, which is on or before
// "today" in every time zone; the client trims to events that have not ended
// in local time. The cap leaves room for the day or two of past rows the
// window starts with.
export async function getUpcomingEvents(fromDate?: string) {
  if (fromDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    return { error: "Invalid date", data: [] };
  }

  const supabase = await createClient();
  const orgId = await getOrgId();

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const from = fromDate ?? yesterday.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("organization_id", orgId)
    .or("status.is.null,status.not.in.(completed,cancelled)")
    .gte("date", from)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(200);

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function createCalendarEvent(eventData: Record<string, unknown>) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      ...pickCalendarColumns(eventData),
      organization_id: orgId,
      created_by: user.id,
    } as CalendarEventInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/calendar");
  return { data };
}

export async function updateCalendarEvent(
  id: string,
  updates: Record<string, unknown>,
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("calendar_events")
    .update(
      pickColumns(updates, CALENDAR_EVENT_UPDATE_COLUMNS) as CalendarEventUpdate,
    )
    .eq("id", id)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/calendar");
  return { data };
}

export async function deleteCalendarEvent(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/calendar");
  return { success: true };
}
