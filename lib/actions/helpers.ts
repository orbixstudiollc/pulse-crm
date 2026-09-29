"use server";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isOpenAccess } from "@/lib/auth/open-access";
import { ensureGuestWorkspace } from "@/lib/auth/guest-workspace";
import { ADMIN_ROLES, hasRequiredRole } from "@/lib/auth/roles";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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

async function resolveOrgId(user: User, profile: ProfileRow): Promise<string> {
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

export async function getOrgId() {
  const { user, profile } = await getCurrentUserProfile();
  return resolveOrgId(user, profile);
}

/**
 * Like getOrgId, but throws unless the caller's profile role is in `allowed`
 * (defaults to admin/owner).
 */
export async function requireRole(
  ...allowed: string[]
): Promise<{ user: User; profile: ProfileRow; orgId: string }> {
  const { user, profile } = await getCurrentUserProfile();
  const orgId = await resolveOrgId(user, profile);

  if (!hasRequiredRole(profile.role, allowed.length ? allowed : ADMIN_ROLES)) {
    throw new Error("Forbidden: admin role required");
  }

  return { user, profile, orgId };
}
