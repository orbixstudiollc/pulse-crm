"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getContacts() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getContactsByLead(leadId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .order("name", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getContactsByCustomer(customerId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("customer_id", customerId)
    .order("name", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getContactById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function createContact(contactData: {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  buying_role?: string;
  influence_level?: string;
  personalization_anchors?: unknown[];
  notes?: string;
  lead_id?: string;
  customer_id?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: orgId,
      name: contactData.name,
      title: contactData.title ?? null,
      email: contactData.email ?? null,
      phone: contactData.phone ?? null,
      linkedin: contactData.linkedin ?? null,
      buying_role: contactData.buying_role ?? "end_user",
      influence_level: contactData.influence_level ?? "medium",
      personalization_anchors: contactData.personalization_anchors ?? [],
      notes: contactData.notes ?? null,
      lead_id: contactData.lead_id ?? null,
      customer_id: contactData.customer_id ?? null,
    } as ContactInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { data };
}

export async function updateContact(
  id: string,
  updates: Partial<{
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedin: string | null;
    buying_role: string;
    influence_level: string;
    personalization_anchors: unknown[];
    notes: string | null;
    lead_id: string | null;
    customer_id: string | null;
  }>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("contacts")
    .update(updates as ContactUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { data };
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("contacts").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { success: true };
}
