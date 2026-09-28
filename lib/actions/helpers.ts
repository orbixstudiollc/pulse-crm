"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isOpenAccess } from "@/lib/auth/open-access";
import { ensureGuestWorkspace } from "@/lib/auth/guest-workspace";

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
  const { user, profile } = await getCurrentUserProfile();

  if (!profile.organization_id) {
    // Open-access mode: guests get a workspace instead of the onboarding form.
    if (isOpenAccess()) {
      const orgId = await ensureGuestWorkspace(user.id);
      if (orgId) return orgId;
    }
    redirect("/onboarding");
  }

  return profile.organization_id;
}
