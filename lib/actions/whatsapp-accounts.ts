"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPhoneNumberDetails, fetchTemplates } from "@/lib/whatsapp/client";
import { revalidatePath } from "next/cache";

// ============================================================
// Get WhatsApp Accounts for current org
// ============================================================

export async function getWhatsAppAccounts() {
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
    .from("whatsapp_accounts")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  return { accounts: data || [], error: error?.message };
}

// ============================================================
// Connect WhatsApp Account
// ============================================================

export async function connectWhatsAppAccount(formData: {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
}) {
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

  // Verify the credentials by fetching phone number details
  const details = await getPhoneNumberDetails(
    formData.phoneNumberId,
    formData.accessToken
  );

  if (details.error) {
    return {
      success: false,
      error: `Failed to verify WhatsApp account: ${details.error}`,
    };
  }

  // Check if any existing accounts for this org — first one becomes default
  const { count } = await supabase
    .from("whatsapp_accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", profile.organization_id);

  const isDefault = (count || 0) === 0;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("whatsapp_accounts")
    .insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      phone_number_id: formData.phoneNumberId,
      waba_id: formData.wabaId,
      access_token_encrypted: formData.accessToken,
      display_phone_number: details.display_phone_number || formData.phoneNumberId,
      verified_name: details.verified_name || null,
      quality_rating: details.quality_rating || null,
      messaging_limit: details.messaging_limit || null,
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
// Disconnect WhatsApp Account
// ============================================================

export async function disconnectWhatsAppAccount(accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("whatsapp_accounts")
    .update({ status: "disconnected" })
    .eq("id", accountId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ============================================================
// Delete WhatsApp Account
// ============================================================

export async function deleteWhatsAppAccount(accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("whatsapp_accounts")
    .delete()
    .eq("id", accountId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ============================================================
// Set Default Account
// ============================================================

export async function setDefaultWhatsAppAccount(accountId: string) {
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

  // Remove default from all accounts in org
  await admin
    .from("whatsapp_accounts")
    .update({ is_default: false })
    .eq("organization_id", profile.organization_id);

  // Set the new default
  const { error } = await admin
    .from("whatsapp_accounts")
    .update({ is_default: true })
    .eq("id", accountId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ============================================================
// Sync Templates from Meta
// ============================================================

export async function syncWhatsAppTemplates(accountId: string) {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (!account) return { success: false, error: "Account not found" };

  const { templates, error: fetchError } = await fetchTemplates(
    account.waba_id,
    account.access_token_encrypted
  );

  if (fetchError) return { success: false, error: fetchError };

  const admin = createAdminClient();

  // Upsert templates
  for (const template of templates) {
    const bodyComponent = template.components.find(
      (c) => c.type === "BODY"
    );
    const headerComponent = template.components.find(
      (c) => c.type === "HEADER"
    );
    const footerComponent = template.components.find(
      (c) => c.type === "FOOTER"
    );

    await admin
      .from("whatsapp_templates")
      .upsert(
        {
          organization_id: account.organization_id,
          whatsapp_account_id: accountId,
          meta_template_id: template.id,
          name: template.name,
          language: template.language,
          category: template.category,
          status: template.status,
          components: template.components as unknown as ReturnType<typeof JSON.parse>,
          header_type: headerComponent?.format || null,
          body_text: bodyComponent?.text || null,
          footer_text: footerComponent?.text || null,
          buttons: template.components.find((c) => c.type === "BUTTONS")?.buttons as unknown as ReturnType<typeof JSON.parse> || null,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "meta_template_id" }
      );
  }

  revalidatePath("/dashboard/settings");
  return { success: true, count: templates.length };
}

// ============================================================
// Get Templates for an Account
// ============================================================

export async function getWhatsAppTemplates(accountId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("whatsapp_templates")
    .select("*")
    .order("name");

  if (accountId) {
    query = query.eq("whatsapp_account_id", accountId);
  }

  const { data, error } = await query;
  return { templates: data || [], error: error?.message };
}

// ============================================================
// Test Connection
// ============================================================

export async function testWhatsAppConnection(accountId: string) {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (!account) return { success: false, error: "Account not found" };

  const details = await getPhoneNumberDetails(
    account.phone_number_id,
    account.access_token_encrypted
  );

  if (details.error) {
    // Update account status to error
    await supabase
      .from("whatsapp_accounts")
      .update({ status: "error", last_error: details.error })
      .eq("id", accountId);

    return { success: false, error: details.error };
  }

  // Update account with fresh data
  await supabase
    .from("whatsapp_accounts")
    .update({
      status: "active",
      verified_name: details.verified_name,
      quality_rating: details.quality_rating,
      messaging_limit: details.messaging_limit,
      last_error: null,
    })
    .eq("id", accountId);

  revalidatePath("/dashboard/settings");
  return { success: true, details };
}
