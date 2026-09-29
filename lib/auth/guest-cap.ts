import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Edge-safe (no next/headers): used from the middleware before an anonymous
// sign-in to enforce the global hourly guest-creation cap.

function admin() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Number of guest workspaces created since `since`, or null if the count failed. */
export async function countRecentGuestWorkspaces(since: Date): Promise<number | null> {
  const { count, error } = await admin()
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .like("slug", "guest-%")
    .gte("created_at", since.toISOString());
  if (error) {
    console.error("[guest-cap]", error.message);
    return null;
  }
  return count;
}
