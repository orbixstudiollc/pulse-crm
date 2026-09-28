import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { GUEST_WORKSPACE_NAME, guestWorkspaceSlug } from "./open-access";

// Edge-safe (no next/headers): used from the middleware right after an
// anonymous sign-in, and from getOrgId as a fallback. Uses the service role
// because the profile row is written by the DB trigger and organization_id is
// protected from user-client writes (migration 028).

function admin() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Returns the user's organization id, creating a guest workspace when the
 * profile has none. Returns null if the profile row does not exist or a write
 * fails; callers fall back to the normal onboarding redirect.
 */
export async function ensureGuestWorkspace(userId: string): Promise<string | null> {
  const db = admin();
  const { data: profile } = await db
    .from("profiles")
    .select("organization_id, first_name")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;
  if (profile.organization_id) return profile.organization_id;

  const { data: org, error: orgError } = await db
    .from("organizations")
    .insert({ name: GUEST_WORKSPACE_NAME, slug: guestWorkspaceSlug(userId) })
    .select("id")
    .single();
  if (orgError || !org) return null;

  const { error: profileError } = await db
    .from("profiles")
    .update({ organization_id: org.id, first_name: profile.first_name || "Guest" })
    .eq("id", userId);
  if (profileError) return null;

  return org.id;
}
