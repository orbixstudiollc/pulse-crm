"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "../helpers";
import { revalidatePath } from "next/cache";

// ── List Custom Actors ──────────────────────────────────────────────────────

export async function getCustomActors() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("lf_custom_actors")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Create Custom Actor ─────────────────────────────────────────────────────

export async function createCustomActor(data: {
  actor_id: string;
  name: string;
  phase: "find" | "enrich";
  description?: string;
  required_input_fields?: string[];
  input_field_descriptions?: Record<string, unknown>;
  default_input?: Record<string, unknown>;
  page_limit_key?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const insertData: Record<string, unknown> = {
    organization_id: orgId,
    actor_id: data.actor_id,
    name: data.name,
    phase: data.phase,
    description: data.description ?? null,
    required_input_fields: data.required_input_fields ?? [],
    input_field_descriptions: data.input_field_descriptions ?? {},
    default_input: data.default_input ?? {},
    page_limit_key: data.page_limit_key ?? null,
    is_enabled: true,
  };

  const { data: actor, error } = await supabase
    .from("lf_custom_actors")
    .insert(insertData as never)
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  revalidatePath("/dashboard/lead-finder");
  return { data: actor };
}

// ── Update Custom Actor ─────────────────────────────────────────────────────

export async function updateCustomActor(
  id: string,
  updates: Record<string, unknown>
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("lf_custom_actors")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  revalidatePath("/dashboard/lead-finder");
  return { data };
}

// ── Delete Custom Actor ─────────────────────────────────────────────────────

export async function deleteCustomActor(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("lf_custom_actors")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/lead-finder");
  return { success: true };
}

// ── Validate Custom Actor on Apify ──────────────────────────────────────────

export async function validateCustomActor(actorId: string) {
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}`,
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );

    if (!response.ok) {
      return { valid: false, error: `Actor "${actorId}" not found on Apify (status ${response.status})` };
    }

    const result = await response.json();
    return {
      valid: true,
      data: {
        id: result.data?.id,
        name: result.data?.name,
        title: result.data?.title,
        description: result.data?.description,
      },
    };
  } catch (err) {
    return { valid: false, error: `Failed to validate: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}
