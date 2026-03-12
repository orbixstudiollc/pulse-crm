"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getIntegrations() {
  const supabase = await createClient();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", user.id)
    .order("integration_name", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function toggleIntegration(
  integrationName: string,
  connected: boolean,
) {
  const supabase = await createClient();
  const { user } = await getCurrentUserProfile();

  // Check if integration record exists
  const { data: existing } = await supabase
    .from("user_integrations")
    .select("id")
    .eq("user_id", user.id)
    .eq("integration_name", integrationName)
    .single();

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from("user_integrations")
      .update({ connected })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings");
    return { data };
  } else {
    // Create new
    const { data, error } = await supabase
      .from("user_integrations")
      .insert({
        user_id: user.id,
        integration_name: integrationName,
        connected,
      })
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings");
    return { data };
  }
}
