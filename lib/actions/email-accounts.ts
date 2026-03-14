"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import { encrypt } from "@/lib/utils/encryption";

// ── Types ───────────────────────────────────────────────────────────────────

interface CustomAccountConfig {
  email_address: string;
  display_name?: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;
  imap_password: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  daily_send_limit?: number;
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getEmailAccounts() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { data: data ?? [] };
}

export async function getEmailAccountById(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (error) return { error: error.message };
  return { data };
}

// ── Create Custom IMAP/SMTP Account ─────────────────────────────────────────

export async function addCustomEmailAccount(config: CustomAccountConfig) {
  const supabase = await createClient();
  const { user } = await getCurrentUserProfile();
  const orgId = await getOrgId();

  // Encrypt passwords before storing
  const encryptedImapPassword = encrypt(config.imap_password);
  const encryptedSmtpPassword = encrypt(config.smtp_password);

  const { data, error } = await supabase
    .from("email_accounts")
    .insert({
      organization_id: orgId,
      user_id: user.id,
      provider: "custom_imap" as const,
      email_address: config.email_address,
      display_name: config.display_name || null,
      imap_config: {
        host: config.imap_host,
        port: config.imap_port,
        secure: config.imap_secure,
        username: config.imap_username,
        password_encrypted: encryptedImapPassword,
      },
      smtp_config: {
        host: config.smtp_host,
        port: config.smtp_port,
        secure: config.smtp_secure,
        username: config.smtp_username,
        password_encrypted: encryptedSmtpPassword,
      },
      daily_send_limit: config.daily_send_limit || 50,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { data };
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function updateEmailAccount(
  id: string,
  updates: {
    display_name?: string;
    daily_send_limit?: number;
    signature_html?: string;
  },
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("email_accounts")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { data };
}

// ── Set Default ─────────────────────────────────────────────────────────────

export async function setDefaultAccount(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Unset all defaults first
  await supabase
    .from("email_accounts")
    .update({ is_default: false })
    .eq("organization_id", orgId);

  // Set the new default
  const { data, error } = await supabase
    .from("email_accounts")
    .update({ is_default: true })
    .eq("id", id)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { data };
}

// ── Update Tracking Domain ───────────────────────────────────────────────────

export async function updateTrackingDomain(accountId: string, trackingDomain: string | null) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Validate domain format if provided
  if (trackingDomain) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(trackingDomain)) {
      return { error: "Invalid domain format. Example: track.yourdomain.com" };
    }
  }

  const { error } = await supabase
    .from("email_accounts")
    .update({ tracking_domain: trackingDomain || null } as Record<string, unknown>)
    .eq("id", accountId)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ── Delete ──────────────────────────────────────────────────────────────────

export async function deleteEmailAccount(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { error } = await supabase
    .from("email_accounts")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ── Test Connection ─────────────────────────────────────────────────────────

export async function testEmailAccount(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: account, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (error || !account) return { error: "Account not found" };

  try {
    if (account.provider === "custom_imap") {
      // Test SMTP connection using nodemailer
      const nodemailer = await import("nodemailer");
      const { decrypt } = await import("@/lib/utils/encryption");
      const smtpConfig = account.smtp_config as {
        host: string;
        port: number;
        secure: boolean;
        username: string;
        password_encrypted: string;
      };

      const transporter = nodemailer.default.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.username,
          pass: decrypt(smtpConfig.password_encrypted),
        },
      });

      await transporter.verify();

      // Update status to active
      await supabase
        .from("email_accounts")
        .update({ status: "active", last_error: null })
        .eq("id", id);

      revalidatePath("/dashboard/settings");
      return { success: true, message: "SMTP connection verified" };
    } else if (account.provider === "gmail") {
      // Test Gmail API connection
      const tokens = account.oauth_tokens as {
        access_token: string;
      } | null;
      if (!tokens?.access_token) {
        return { error: "No OAuth tokens found. Please reconnect." };
      }

      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );

      if (!res.ok) {
        await supabase
          .from("email_accounts")
          .update({ status: "error", last_error: "OAuth token expired" })
          .eq("id", id);
        return { error: "Gmail token expired. Please reconnect." };
      }

      await supabase
        .from("email_accounts")
        .update({ status: "active", last_error: null })
        .eq("id", id);

      revalidatePath("/dashboard/settings");
      return { success: true, message: "Gmail connection verified" };
    } else if (account.provider === "microsoft") {
      const tokens = account.oauth_tokens as {
        access_token: string;
      } | null;
      if (!tokens?.access_token) {
        return { error: "No OAuth tokens found. Please reconnect." };
      }

      const res = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!res.ok) {
        await supabase
          .from("email_accounts")
          .update({ status: "error", last_error: "OAuth token expired" })
          .eq("id", id);
        return { error: "Microsoft token expired. Please reconnect." };
      }

      await supabase
        .from("email_accounts")
        .update({ status: "active", last_error: null })
        .eq("id", id);

      revalidatePath("/dashboard/settings");
      return { success: true, message: "Microsoft connection verified" };
    }

    return { error: "Unknown provider" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    await supabase
      .from("email_accounts")
      .update({ status: "error", last_error: message })
      .eq("id", id);

    revalidatePath("/dashboard/settings");
    return { error: message };
  }
}
