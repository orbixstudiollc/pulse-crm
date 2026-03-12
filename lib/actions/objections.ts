"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type ObjectionInsert =
  Database["public"]["Tables"]["objection_playbook"]["Insert"];
type ObjectionUpdate =
  Database["public"]["Tables"]["objection_playbook"]["Update"];

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getObjections() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("objection_playbook")
    .select("*")
    .eq("organization_id", orgId)
    .order("category", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getObjectionsByCategory(category: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("objection_playbook")
    .select("*")
    .eq("organization_id", orgId)
    .eq("category", category)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getObjectionById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("objection_playbook")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function createObjection(objectionData: {
  category: string;
  objection_text: string;
  hidden_meaning?: string;
  ffr_response?: string;
  abc_response?: string;
  follow_up_question?: string;
  proof_point?: string;
  walk_away_criteria?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("objection_playbook")
    .insert({
      organization_id: orgId,
      category: objectionData.category,
      objection_text: objectionData.objection_text,
      hidden_meaning: objectionData.hidden_meaning ?? null,
      ffr_response: objectionData.ffr_response ?? null,
      abc_response: objectionData.abc_response ?? null,
      follow_up_question: objectionData.follow_up_question ?? null,
      proof_point: objectionData.proof_point ?? null,
      walk_away_criteria: objectionData.walk_away_criteria ?? null,
    } as ObjectionInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/playbook");
  return { data };
}

export async function updateObjection(
  id: string,
  updates: Partial<{
    category: string;
    objection_text: string;
    hidden_meaning: string | null;
    ffr_response: string | null;
    abc_response: string | null;
    follow_up_question: string | null;
    proof_point: string | null;
    walk_away_criteria: string | null;
  }>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("objection_playbook")
    .update(updates as ObjectionUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/playbook");
  return { data };
}

export async function deleteObjection(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("objection_playbook")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/playbook");
  return { success: true };
}
