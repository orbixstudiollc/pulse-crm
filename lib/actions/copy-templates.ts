"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type CopyTemplateInsert = Database["public"]["Tables"]["copy_templates"]["Insert"];
type CopyTemplateUpdate = Database["public"]["Tables"]["copy_templates"]["Update"];

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getCopyTemplates() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copy_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("usage_count", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getCopyTemplatesByCategory(category: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copy_templates")
    .select("*")
    .eq("organization_id", orgId)
    .eq("category", category)
    .order("usage_count", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getCopyTemplateById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("copy_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function createCopyTemplate(templateData: {
  name: string;
  category?: string;
  headline?: string;
  body?: string;
  cta?: string;
  tags?: string[];
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copy_templates")
    .insert({
      organization_id: orgId,
      name: templateData.name,
      category: templateData.category ?? "email_subject",
      headline: templateData.headline ?? null,
      body: templateData.body ?? null,
      cta: templateData.cta ?? null,
      tags: templateData.tags ?? [],
    } as CopyTemplateInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/copy-library");
  return { data };
}

export async function updateCopyTemplate(
  id: string,
  updates: Partial<{
    name: string;
    category: string;
    headline: string;
    body: string;
    cta: string;
    tags: string[];
  }>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("copy_templates")
    .update(updates as CopyTemplateUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/copy-library");
  return { data };
}

export async function deleteCopyTemplate(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("copy_templates").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/copy-library");
  return { success: true };
}

export async function incrementUsageCount(id: string) {
  const supabase = await createClient();
  await getOrgId();

  // Fetch current count, then increment
  const { data: template, error: fetchError } = await supabase
    .from("copy_templates")
    .select("usage_count")
    .eq("id", id)
    .single();

  if (fetchError || !template) return { error: fetchError?.message || "Template not found" };

  const { error } = await supabase
    .from("copy_templates")
    .update({ usage_count: template.usage_count + 1 })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/copy-library");
  return { success: true };
}
