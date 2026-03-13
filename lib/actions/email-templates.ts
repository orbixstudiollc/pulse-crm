"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type TemplateInsert = Database["public"]["Tables"]["email_templates"]["Insert"];
type TemplateUpdate = Database["public"]["Tables"]["email_templates"]["Update"];

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function getEmailTemplates(category?: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("email_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("usage_count", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getEmailTemplateById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function createEmailTemplate(templateData: {
  name: string;
  subject: string;
  body: string;
  category?: string;
  merge_fields?: string[];
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      organization_id: orgId,
      name: templateData.name,
      subject: templateData.subject,
      body: templateData.body,
      category: templateData.category ?? "general",
      merge_fields: templateData.merge_fields ?? [],
    } as TemplateInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { data };
}

export async function updateEmailTemplate(
  id: string,
  updates: Partial<{
    name: string;
    subject: string;
    body: string;
    category: string;
    merge_fields: string[];
  }>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("email_templates")
    .update(updates as TemplateUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { data };
}

export async function deleteEmailTemplate(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("email_templates").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { success: true };
}

// ── Merge Field Rendering ───────────────────────────────────────────────────

export async function renderTemplate(
  templateId: string,
  leadId: string,
): Promise<{ subject: string; body: string } | { error: string }> {
  const supabase = await createClient();

  const [templateRes, leadRes] = await Promise.all([
    supabase.from("email_templates").select("*").eq("id", templateId).single(),
    supabase.from("leads").select("*").eq("id", leadId).single(),
  ]);

  if (templateRes.error || !templateRes.data) return { error: "Template not found" };
  if (leadRes.error || !leadRes.data) return { error: "Lead not found" };

  const template = templateRes.data;
  const lead = leadRes.data;

  const nameParts = (lead.name || "").split(" ");
  const mergeValues: Record<string, string> = {
    "{{firstName}}": nameParts[0] || "",
    "{{lastName}}": nameParts.slice(1).join(" ") || "",
    "{{company}}": lead.company || "",
    "{{industry}}": lead.industry || "",
    "{{email}}": lead.email || "",
    "{{phone}}": lead.phone || "",
    "{{website}}": lead.website || "",
    "{{title}}": lead.title || "",
    "{{location}}": lead.location || "",
    "{{painPoints}}": lead.pain_points || "",
    "{{triggerEvent}}": lead.trigger_event || "",
    "{{techStack}}": lead.tech_stack || "",
    "{{currentSolution}}": lead.current_solution || "",
    "{{referredBy}}": lead.referred_by || "",
    "{{personalNote}}": lead.personal_note || "",
    "{{fundingStage}}": lead.funding_stage || "",
    "{{revenueRange}}": lead.revenue_range || "",
    "{{decisionRole}}": lead.decision_role || "",
    "{{timezone}}": lead.timezone || "",
    "{{tags}}": Array.isArray(lead.tags) ? lead.tags.join(", ") : "",
  };

  let subject = template.subject;
  let body = template.body;

  for (const [field, value] of Object.entries(mergeValues)) {
    subject = subject.replaceAll(field, value);
    body = body.replaceAll(field, value);
  }

  // Increment usage
  await supabase
    .from("email_templates")
    .update({ usage_count: template.usage_count + 1 })
    .eq("id", templateId);

  return { subject, body };
}
