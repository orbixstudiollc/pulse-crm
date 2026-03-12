"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];

// ── Types ────────────────────────────────────────────────────────────────────

export type CustomerFilters = {
  search?: string;
  status?: string;
  plan?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getCustomers(filters: CustomerFilters = {}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const {
    search,
    status,
    plan,
    sortBy = "created_at",
    sortOrder = "desc",
    page = 1,
    perPage = 50,
  } = filters;

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`,
    );
  }

  if (status && status !== "all") {
    query = query.eq("status", status as Database["public"]["Enums"]["customer_status"]);
  }

  if (plan && plan !== "all") {
    query = query.eq("plan", plan as Database["public"]["Enums"]["customer_plan"]);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, error, count } = await query;

  if (error) return { error: error.message, data: [], count: 0 };
  return { data: data ?? [], count: count ?? 0 };
}

export async function getCustomerById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null as null };
  return { error: null, data };
}

export async function getCustomerNotes(customerId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_notes")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getCustomerActivities(customerId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_activities")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getCustomerCustomFields(customerId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_custom_fields")
    .select("*")
    .eq("customer_id", customerId);

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function createCustomer(
  customerData: Record<string, unknown>,
) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...customerData,
      organization_id: orgId,
      created_by: user.id,
    } as CustomerInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/customers");
  return { data };
}

export async function updateCustomer(
  id: string,
  updates: Record<string, unknown>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("customers")
    .update(updates as CustomerUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  return { data };
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function addCustomerNote(
  customerId: string,
  content: string,
) {
  const supabase = await createClient();
  const { user, profile } = await getCurrentUserProfile();

  const authorName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email;

  const { data, error } = await supabase
    .from("customer_notes")
    .insert({
      customer_id: customerId,
      author_id: user.id,
      author_name: authorName,
      content,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { data };
}
