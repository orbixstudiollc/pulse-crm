"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

// ── Sign In ──────────────────────────────────────────────────────────────────

export async function signInWithEmail(formData: {
  email: string;
  password: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard/overview");
}

// ── Sign Up ──────────────────────────────────────────────────────────────────

export async function signUp(formData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || "";

  const { error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        first_name: formData.firstName,
        last_name: formData.lastName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ── Sign In with Google ──────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || "";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}

// ── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPassword(email: string) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || "";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(newPassword: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ── Resend Verification Email ────────────────────────────────────────────────

export async function resendVerificationEmail(email: string) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || "";

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ── Onboarding: Create Organization ─────────────────────────────────────────

export async function completeOnboardingStep1(formData: {
  companyName: string;
  companySize: string;
  userRole: string;
  goal: string;
}) {
  const supabase = await createClient();
  const admin = createAdminClient();

  // Verify the user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Create organization (admin client bypasses RLS)
  const slug = formData.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: formData.companyName, slug: `${slug}-${Date.now()}` })
    .select()
    .single();

  if (orgError) {
    return { error: orgError.message };
  }

  // Update profile with organization and role (admin client bypasses RLS)
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      organization_id: org.id,
      job_title: formData.userRole || null,
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  return { success: true };
}

// ── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
