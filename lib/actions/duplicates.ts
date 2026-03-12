"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";

// ── Types ────────────────────────────────────────────────────────────────────

type DuplicateLead = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  status: string | null;
  score: number | null;
  created_at: string;
};

type DuplicateGroup = {
  email: string;
  leads: DuplicateLead[];
};

// ── Find Duplicates by Email/Name ────────────────────────────────────────────

export async function findDuplicates(email: string, name?: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const selectFields = "id, name, email, company, status, score, created_at";

  // Check exact email match
  const { data: exactMatches, error: emailError } = await supabase
    .from("leads")
    .select(selectFields)
    .eq("email", email)
    .eq("organization_id", orgId);

  if (emailError) return { error: emailError.message };

  // If name provided and no email matches, do fuzzy name match
  let fuzzyMatches: DuplicateLead[] = [];

  if (name && (!exactMatches || exactMatches.length === 0)) {
    const { data: nameMatches, error: nameError } = await supabase
      .from("leads")
      .select(selectFields)
      .ilike("name", `%${name}%`)
      .eq("organization_id", orgId);

    if (nameError) return { error: nameError.message };
    fuzzyMatches = (nameMatches as DuplicateLead[]) ?? [];
  }

  return {
    data: {
      exactMatches: (exactMatches as DuplicateLead[]) ?? [],
      fuzzyMatches,
    },
  };
}

// ── Find All Duplicate Groups ────────────────────────────────────────────────

export async function findAllDuplicates() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, email, company, status, score")
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  if (!leads || leads.length === 0) return { data: [] };

  // Group by email (case-insensitive)
  const emailGroups = new Map<string, DuplicateLead[]>();

  for (const lead of leads) {
    if (!lead.email) continue;
    const normalizedEmail = lead.email.toLowerCase();

    if (!emailGroups.has(normalizedEmail)) {
      emailGroups.set(normalizedEmail, []);
    }
    emailGroups.get(normalizedEmail)!.push(lead as DuplicateLead);
  }

  // Return only groups with 2+ leads
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [email, groupLeads] of emailGroups) {
    if (groupLeads.length >= 2) {
      duplicateGroups.push({ email, leads: groupLeads });
    }
  }

  return { data: duplicateGroups };
}

// ── Merge Duplicates ─────────────────────────────────────────────────────────

export async function mergeDuplicates(keepId: string, mergeIds: string[]) {
  const supabase = await createClient();
  await getOrgId();

  // Verify the "keep" lead exists
  const { data: keepLead, error: keepError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", keepId)
    .single();

  if (keepError || !keepLead) {
    return { error: keepError?.message || "Primary lead not found" };
  }

  // Delete the merge leads
  const { error: deleteError } = await supabase
    .from("leads")
    .delete()
    .in("id", mergeIds);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/dashboard/leads");
  return { data: { merged: mergeIds.length, kept: keepId } };
}
