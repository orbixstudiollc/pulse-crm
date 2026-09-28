"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/linkedin/client";
import { revalidatePath } from "next/cache";
import { openChannelToken, sealChannelToken } from "@/lib/utils/channel-token";

const LINKEDIN_ACCOUNT_PUBLIC_COLUMNS =
  "id, organization_id, user_id, linkedin_id, display_name, profile_url, avatar_url, token_expires_at, scopes, status, daily_connection_requests, daily_messages_sent, weekly_connection_requests, daily_profile_views, daily_endorsements, daily_connection_limit, daily_message_limit, weekly_connection_limit, daily_profile_view_limit, daily_endorsement_limit, last_error, is_default, created_at, updated_at";

// ============================================================
// Get LinkedIn Accounts for current org
// ============================================================

export async function getLinkedInAccounts() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { accounts: [], error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return { accounts: [], error: "No organization" };

  const { data, error } = await supabase
    .from("linkedin_accounts")
    .select(LINKEDIN_ACCOUNT_PUBLIC_COLUMNS)
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  return { accounts: data || [], error: error?.message };
}

// ============================================================
// Save LinkedIn Account (after OAuth callback)
// ============================================================

export async function saveLinkedInAccount(params: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scopes?: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!userProfile?.organization_id) return { success: false, error: "No organization" };

  // Get LinkedIn profile info
  const { profile: liProfile, error: profileError } = await getCurrentProfile(
    params.accessToken
  );

  if (profileError) {
    return { success: false, error: `Failed to verify LinkedIn: ${profileError}` };
  }

  // Check if first account in org
  const { count } = await supabase
    .from("linkedin_accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", userProfile.organization_id);

  const isDefault = (count || 0) === 0;

  let sealedAccessToken: string;
  let sealedRefreshToken: string | null;
  try {
    sealedAccessToken = sealChannelToken(params.accessToken);
    sealedRefreshToken = params.refreshToken ? sealChannelToken(params.refreshToken) : null;
  } catch {
    return { success: false, error: "ENCRYPTION_KEY is not configured" };
  }

  const admin = createAdminClient();
  const tokenExpiresAt = params.expiresIn
    ? new Date(Date.now() + params.expiresIn * 1000).toISOString()
    : null;

  const { data, error } = await admin
    .from("linkedin_accounts")
    .insert({
      organization_id: userProfile.organization_id,
      user_id: user.id,
      linkedin_id: liProfile?.id || null,
      display_name: liProfile
        ? `${liProfile.localizedFirstName || ""} ${liProfile.localizedLastName || ""}`.trim()
        : null,
      profile_url: liProfile?.vanityName
        ? `https://www.linkedin.com/in/${liProfile.vanityName}`
        : null,
      access_token_encrypted: sealedAccessToken,
      refresh_token_encrypted: sealedRefreshToken,
      token_expires_at: tokenExpiresAt,
      scopes: params.scopes || null,
      is_default: isDefault,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true, accountId: data.id };
}

// ============================================================
// Disconnect LinkedIn Account
// ============================================================

export async function disconnectLinkedInAccount(accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("linkedin_accounts")
    .update({ status: "disconnected" })
    .eq("id", accountId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ============================================================
// Delete LinkedIn Account
// ============================================================

export async function deleteLinkedInAccount(accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("linkedin_accounts")
    .delete()
    .eq("id", accountId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ============================================================
// Set Default Account
// ============================================================

export async function setDefaultLinkedInAccount(accountId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return { success: false, error: "No organization" };

  const admin = createAdminClient();

  // Remove default from all accounts
  await admin
    .from("linkedin_accounts")
    .update({ is_default: false })
    .eq("organization_id", profile.organization_id);

  // Set new default
  const { error } = await admin
    .from("linkedin_accounts")
    .update({ is_default: true })
    .eq("id", accountId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ============================================================
// Update Rate Limits
// ============================================================

export async function updateLinkedInLimits(
  accountId: string,
  limits: {
    daily_connection_limit?: number;
    daily_message_limit?: number;
    weekly_connection_limit?: number;
    daily_profile_view_limit?: number;
    daily_endorsement_limit?: number;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("linkedin_accounts")
    .update(limits)
    .eq("id", accountId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ============================================================
// Test Connection
// ============================================================

export async function testLinkedInConnection(accountId: string) {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("linkedin_accounts")
    .select("id, organization_id, linkedin_id, access_token_encrypted")
    .eq("id", accountId)
    .single();

  if (!account) return { success: false, error: "Account not found" };

  const token = openChannelToken(account.access_token_encrypted);
  if (!token) return { success: false, error: "Stored LinkedIn token is unreadable; reconnect the account" };

  const { profile, error: profileError } = await getCurrentProfile(token);

  if (profileError) {
    await supabase
      .from("linkedin_accounts")
      .update({ status: "error", last_error: profileError })
      .eq("id", accountId);

    return { success: false, error: profileError };
  }

  // Update with fresh profile data
  await supabase
    .from("linkedin_accounts")
    .update({
      status: "active",
      linkedin_id: profile?.id,
      display_name: profile
        ? `${profile.localizedFirstName || ""} ${profile.localizedLastName || ""}`.trim()
        : null,
      last_error: null,
    })
    .eq("id", accountId);

  revalidatePath("/dashboard/settings");
  return { success: true, profile };
}
