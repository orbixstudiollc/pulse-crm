"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database, Json } from "@/types/database";

type ProposalInsert = Database["public"]["Tables"]["proposals"]["Insert"];
type ProposalUpdate = Database["public"]["Tables"]["proposals"]["Update"];

// ── Proposals CRUD ──────────────────────────────────────────────────────────

export async function getProposals() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getProposalById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function createProposal(proposalData: {
  title: string;
  deal_id?: string;
  content?: Record<string, unknown>;
  pricing_tiers?: Record<string, unknown>;
  valid_until?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      organization_id: orgId,
      title: proposalData.title,
      deal_id: proposalData.deal_id ?? null,
      content: (proposalData.content ?? {}) as Json,
      pricing_tiers: (proposalData.pricing_tiers ?? {}) as Json,
      valid_until: proposalData.valid_until ?? null,
      status: "draft",
    } as ProposalInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/proposals");
  return { data };
}

export async function updateProposal(
  id: string,
  updates: Partial<{
    title: string;
    deal_id: string | null;
    status: string;
    content: Record<string, unknown>;
    pricing_tiers: Record<string, unknown>;
    valid_until: string | null;
    sent_at: string | null;
    viewed_at: string | null;
  }>,
) {
  const supabase = await createClient();
  await getOrgId();

  const updateData: Record<string, unknown> = { ...updates };
  if (updates.content) updateData.content = updates.content as Json;
  if (updates.pricing_tiers)
    updateData.pricing_tiers = updates.pricing_tiers as Json;

  const { data, error } = await supabase
    .from("proposals")
    .update(updateData as ProposalUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/proposals");
  return { data };
}

export async function deleteProposal(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("proposals").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/proposals");
  return { success: true };
}

export async function markProposalSent(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("proposals")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    } as ProposalUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/proposals");
  return { data };
}

export async function markProposalViewed(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("proposals")
    .update({
      status: "viewed",
      viewed_at: new Date().toISOString(),
    } as ProposalUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/proposals");
  return { data };
}
