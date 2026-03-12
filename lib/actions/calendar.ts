"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type CalendarEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type CalendarEventUpdate = Database["public"]["Tables"]["calendar_events"]["Update"];

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
    .order("time", { ascending: true });

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

export async function getUpcomingEvents(limit: number = 5) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "scheduled")
    .gte("date", today)
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(limit);

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
      ...eventData,
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
  await getOrgId();

  const { data, error } = await supabase
    .from("calendar_events")
    .update(updates as CalendarEventUpdate)
    .eq("id", id)
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
