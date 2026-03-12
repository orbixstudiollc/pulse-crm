"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  return { user, profile };
}

export async function getOrgId() {
  const { profile } = await getCurrentUserProfile();

  if (!profile.organization_id) {
    redirect("/onboarding");
  }

  return profile.organization_id;
}
