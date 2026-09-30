"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, requireRole } from "./helpers";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { encrypt } from "@/lib/utils/encryption";
import { openOAuthTokens } from "@/lib/email/oauth-tokens";
import {
  assertSafeMailHost,
  isAllowedImapPort,
  isAllowedSmtpPort,
  resolveMailHost,
  sanitizeMailConfig,
} from "@/lib/email/account-validation";

const INVALID_MAIL_SERVER = "Invalid mail server host or port";
const CONNECTION_FAILED = "Connection failed. Check host, port, TLS setting and credentials.";

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

// OAuth tokens (sealed or legacy plaintext) must never reach the browser
function withoutOAuthTokens<T extends { oauth_tokens?: unknown }>(row: T): Omit<T, "oauth_tokens"> {
  const { oauth_tokens, ...rest } = row;
  void oauth_tokens;
  return rest;
}

// Encrypted mail passwords must never reach the browser either
function stripMailSecrets<T extends { oauth_tokens?: unknown; smtp_config?: unknown; imap_config?: unknown }>(row: T) {
  return {
    ...withoutOAuthTokens(row),
    smtp_config: sanitizeMailConfig(row.smtp_config),
    imap_config: sanitizeMailConfig(row.imap_config),
  };
}

// Validates a smtp_config/imap_config value carried by an update
async function isSafeMailConfigUpdate(cfg: unknown, kind: "smtp" | "imap"): Promise<boolean> {
  if (!cfg || typeof cfg !== "object") return false;
  const { host, port } = cfg as { host?: unknown; port?: unknown };
  if (typeof host !== "string") return false;
  if (!(kind === "smtp" ? isAllowedSmtpPort(port) : isAllowedImapPort(port))) return false;
  try {
    await assertSafeMailHost(host);
    return true;
  } catch {
    return false;
  }
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
  return { data: (data ?? []).map(stripMailSecrets) };
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
  return { data: stripMailSecrets(data) };
}

// ── Create Custom IMAP/SMTP Account ─────────────────────────────────────────

export async function addCustomEmailAccount(config: CustomAccountConfig) {
  const supabase = await createClient();
  let gate: Awaited<ReturnType<typeof requireRole>>;
  try {
    gate = await requireRole("admin", "owner");
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof Error ? err.message : "Forbidden: admin role required" };
  }
  const { user, orgId } = gate;

  if (!isAllowedImapPort(config.imap_port) || !isAllowedSmtpPort(config.smtp_port)) {
    return { error: INVALID_MAIL_SERVER };
  }
  try {
    await assertSafeMailHost(config.imap_host);
    await assertSafeMailHost(config.smtp_host);
  } catch {
    return { error: INVALID_MAIL_SERVER };
  }

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
  return { data: stripMailSecrets(data) };
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
  let orgId: string;
  try {
    ({ orgId } = await requireRole("admin", "owner"));
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof Error ? err.message : "Forbidden: admin role required" };
  }

  // Server actions receive untyped input, so a mail config may still be present
  const raw = updates as Record<string, unknown>;
  if ("smtp_config" in raw && !(await isSafeMailConfigUpdate(raw.smtp_config, "smtp"))) {
    return { error: INVALID_MAIL_SERVER };
  }
  if ("imap_config" in raw && !(await isSafeMailConfigUpdate(raw.imap_config, "imap"))) {
    return { error: INVALID_MAIL_SERVER };
  }

  const { data, error } = await supabase
    .from("email_accounts")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { data: stripMailSecrets(data) };
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
  return { data: withoutOAuthTokens(data) };
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
  let orgId: string;
  try {
    ({ orgId } = await requireRole("admin", "owner"));
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof Error ? err.message : "Forbidden: admin role required" };
  }

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

      const resolved = await resolveMailHost(smtpConfig.host, smtpConfig.port, "smtp");
      if (!resolved) {
        return { error: INVALID_MAIL_SERVER };
      }

      const transporter = nodemailer.default.createTransport({
        host: resolved.address,
        tls: { servername: resolved.servername },
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        requireTLS: !smtpConfig.secure,
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
      const tokens = openOAuthTokens(account.oauth_tokens);
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
      const tokens = openOAuthTokens(account.oauth_tokens);
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
    // The real error stays server-side: it would reveal how the host/port answered
    console.error("[testEmailAccount] connection test failed:", err);
    await supabase
      .from("email_accounts")
      .update({ status: "error", last_error: CONNECTION_FAILED })
      .eq("id", id);

    revalidatePath("/dashboard/settings");
    return { error: CONNECTION_FAILED };
  }
}
