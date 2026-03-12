"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];

// ── Types ────────────────────────────────────────────────────────────────────

export type ActivityFilters = {
  search?: string;
  type?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getActivities(filters: ActivityFilters = {}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const {
    search,
    type,
    status,
    sortBy = "date",
    sortOrder = "desc",
    page = 1,
    perPage = 50,
  } = filters;

  let query = supabase
    .from("activities")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId);

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,description.ilike.%${search}%`,
    );
  }

  if (type && type !== "all") {
    query = query.eq("type", type as Database["public"]["Enums"]["activity_type"]);
  }

  if (status && status !== "all") {
    query = query.eq("status", status as Database["public"]["Enums"]["activity_status"]);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, error, count } = await query;

  if (error) return { error: error.message, data: [], count: 0 };
  return { data: data ?? [], count: count ?? 0 };
}

export async function getActivityById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function createActivity(activityData: Record<string, unknown>) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("activities")
    .insert({
      ...activityData,
      organization_id: orgId,
      created_by: user.id,
    } as ActivityInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/activity");
  return { data };
}

export async function updateActivity(
  id: string,
  updates: Record<string, unknown>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("activities")
    .update(updates as ActivityUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/activity");
  return { data };
}

export async function updateActivityStatus(id: string, status: string) {
  return updateActivity(id, { status });
}

export async function deleteActivity(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("activities").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/activity");
  return { success: true };
}
