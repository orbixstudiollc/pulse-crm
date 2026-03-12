"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type DealInsert = Database["public"]["Tables"]["deals"]["Insert"];
type DealUpdate = Database["public"]["Tables"]["deals"]["Update"];

// ── Types ────────────────────────────────────────────────────────────────────

export type DealFilters = {
  search?: string;
  stage?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getDeals(filters: DealFilters = {}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const {
    search,
    stage,
    sortBy = "created_at",
    sortOrder = "desc",
    page = 1,
    perPage = 100,
  } = filters;

  let query = supabase
    .from("deals")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId);

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,company.ilike.%${search}%,contact_name.ilike.%${search}%`,
    );
  }

  if (stage && stage !== "all") {
    query = query.eq("stage", stage as Database["public"]["Enums"]["deal_stage"]);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, error, count } = await query;

  if (error) return { error: error.message, data: [], count: 0 };
  return { data: data ?? [], count: count ?? 0 };
}

export async function getDealById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function getDealsByCustomerId(customerId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getDealNotes(dealId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_notes")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getDealActivities(dealId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_activities")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function createDeal(dealData: Record<string, unknown>) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("deals")
    .insert({
      ...dealData,
      organization_id: orgId,
      created_by: user.id,
      owner_id: user.id,
    } as DealInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sales");
  return { data };
}

export async function updateDeal(
  id: string,
  updates: Record<string, unknown>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("deals")
    .update(updates as DealUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sales");
  revalidatePath(`/dashboard/sales/${id}`);
  return { data };
}

export async function updateDealStage(id: string, stage: string) {
  return updateDeal(id, { stage, days_in_stage: 0 });
}

export async function deleteDeal(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("deals").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sales");
  return { success: true };
}

export async function addDealNote(dealId: string, content: string) {
  const supabase = await createClient();
  const { user, profile } = await getCurrentUserProfile();

  const authorName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email;

  const { data, error } = await supabase
    .from("deal_notes")
    .insert({
      deal_id: dealId,
      author_id: user.id,
      author_name: authorName,
      content,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/sales/${dealId}`);
  return { data };
}
