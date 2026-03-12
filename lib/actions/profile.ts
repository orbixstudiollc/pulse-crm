"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database, Json } from "@/types/database";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated", data: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function updateProfile(updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("profiles")
    .update(updates as ProfileUpdate)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { data };
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const { user } = await getCurrentUserProfile();

  const file = formData.get("avatar") as File;
  if (!file) return { error: "No file provided" };

  const fileExt = file.name.split(".").pop();
  const filePath = `${user.id}/avatar.${fileExt}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });

  if (uploadError) return { error: uploadError.message };

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);

  // Update profile with avatar URL
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { data };
}

export async function removeAvatar() {
  const supabase = await createClient();
  const { user } = await getCurrentUserProfile();

  // Remove from storage
  const { error: deleteError } = await supabase.storage
    .from("avatars")
    .remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`]);

  if (deleteError) return { error: deleteError.message };

  // Clear avatar URL in profile
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { data };
}

export async function updatePreferences(preferences: Record<string, unknown>) {
  const supabase = await createClient();
  const { user } = await getCurrentUserProfile();

  // Map preferences object to direct profile columns
  const updates: Record<string, unknown> = {};
  if (preferences.timezone !== undefined) updates.timezone = preferences.timezone;
  if (preferences.date_format !== undefined) updates.date_format = preferences.date_format;
  if (preferences.time_format !== undefined) updates.time_format = preferences.time_format;
  if (preferences.language !== undefined) updates.language = preferences.language;

  const { data, error } = await supabase
    .from("profiles")
    .update(updates as ProfileUpdate)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { data };
}

export async function updateNotificationPreferences(
  notificationPreferences: Record<string, unknown>,
) {
  const supabase = await createClient();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("profiles")
    .update({ notification_preferences: notificationPreferences as unknown as Json } as ProfileUpdate)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { data };
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string,
) {
  const supabase = await createClient();

  // Verify current password by re-authenticating
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { error: "No email found" };

  // Try to sign in with current password to verify
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) return { error: "Current password is incorrect" };

  // Update to new password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) return { error: error.message };

  return { success: true };
}
