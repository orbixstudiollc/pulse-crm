import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/utils/encryption";

// ── Types ──────────────────────────────────────────────────────────────────

interface SendEmailOptions {
  accountId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ── Token Refresh ──────────────────────────────────────────────────────────

async function refreshGmailToken(account: {
  id: string;
  oauth_tokens: { refresh_token: string; scope?: string };
}): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: account.oauth_tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;

  const tokens = await res.json();
  const supabase = createAdminClient();

  await supabase
    .from("email_accounts")
    .update({
      oauth_tokens: {
        access_token: tokens.access_token,
        refresh_token: account.oauth_tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope || account.oauth_tokens.scope,
      },
    })
    .eq("id", account.id);

  return tokens.access_token;
}

async function refreshMicrosoftToken(account: {
  id: string;
  oauth_tokens: { refresh_token: string; scope?: string };
}): Promise<string | null> {
  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: account.oauth_tokens.refresh_token,
        grant_type: "refresh_token",
      }),
    },
  );

  if (!res.ok) return null;

  const tokens = await res.json();
  const supabase = createAdminClient();

  await supabase
    .from("email_accounts")
    .update({
      oauth_tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || account.oauth_tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope || account.oauth_tokens.scope,
      },
    })
    .eq("id", account.id);

  return tokens.access_token;
}

// ── Get Valid Access Token ─────────────────────────────────────────────────

async function getValidAccessToken(account: {
  id: string;
  provider: string;
  oauth_tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    scope?: string;
  } | null;
}): Promise<string | null> {
  if (!account.oauth_tokens) return null;

  // If token is still valid (with 5 min buffer), use it
  if (account.oauth_tokens.expires_at > Date.now() + 5 * 60 * 1000) {
    return account.oauth_tokens.access_token;
  }

  // Refresh
  if (account.provider === "gmail") {
    return refreshGmailToken(
      account as { id: string; oauth_tokens: { refresh_token: string; scope?: string } },
    );
  }
  if (account.provider === "microsoft") {
    return refreshMicrosoftToken(
      account as { id: string; oauth_tokens: { refresh_token: string; scope?: string } },
    );
  }

  return null;
}

// ── Send via Gmail API ─────────────────────────────────────────────────────

async function sendViaGmail(
  accessToken: string,
  from: string,
  opts: SendEmailOptions,
): Promise<SendResult> {
  // Build raw MIME message
  const boundary = `boundary_${Date.now()}`;
  const headers = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (opts.cc) headers.push(`Cc: ${opts.cc}`);
  if (opts.replyTo) headers.push(`Reply-To: ${opts.replyTo}`);
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);

  if (opts.headers) {
    for (const [key, value] of Object.entries(opts.headers)) {
      headers.push(`${key}: ${value}`);
    }
  }

  const textPart = opts.text || opts.html.replace(/<[^>]*>/g, "");
  const rawMessage = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    textPart,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    opts.html,
    `--${boundary}--`,
  ].join("\r\n");

  // Base64url encode
  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `Gmail API error: ${err}` };
  }

  const data = await res.json();
  return { success: true, messageId: data.id };
}

// ── Send via Microsoft Graph ───────────────────────────────────────────────

async function sendViaMicrosoft(
  accessToken: string,
  opts: SendEmailOptions,
): Promise<SendResult> {
  const toRecipients = opts.to.split(",").map((e) => ({
    emailAddress: { address: e.trim() },
  }));

  const message: Record<string, unknown> = {
    subject: opts.subject,
    body: { contentType: "HTML", content: opts.html },
    toRecipients,
  };

  if (opts.cc) {
    message.ccRecipients = opts.cc.split(",").map((e) => ({
      emailAddress: { address: e.trim() },
    }));
  }

  if (opts.replyTo) {
    message.replyTo = [{ emailAddress: { address: opts.replyTo } }];
  }

  const headers: Record<string, string>[] = [];
  if (opts.inReplyTo) {
    headers.push({ name: "In-Reply-To", value: opts.inReplyTo });
  }
  if (opts.references) {
    headers.push({ name: "References", value: opts.references });
  }
  if (headers.length) {
    message.internetMessageHeaders = headers;
  }

  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me/sendMail",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `Microsoft Graph error: ${err}` };
  }

  return { success: true, messageId: `ms_${Date.now()}` };
}

// ── Send via SMTP (Nodemailer) ─────────────────────────────────────────────

async function sendViaSMTP(
  account: {
    email_address: string;
    display_name: string | null;
    smtp_config: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password_encrypted: string;
    };
  },
  opts: SendEmailOptions,
): Promise<SendResult> {
  const transporter = nodemailer.createTransport({
    host: account.smtp_config.host,
    port: account.smtp_config.port,
    secure: account.smtp_config.secure,
    auth: {
      user: account.smtp_config.username,
      pass: decrypt(account.smtp_config.password_encrypted),
    },
  });

  const from = account.display_name
    ? `"${account.display_name}" <${account.email_address}>`
    : account.email_address;

  const mailOpts: nodemailer.SendMailOptions = {
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  };

  if (opts.cc) mailOpts.cc = opts.cc;
  if (opts.bcc) mailOpts.bcc = opts.bcc;
  if (opts.replyTo) mailOpts.replyTo = opts.replyTo;
  if (opts.inReplyTo) mailOpts.inReplyTo = opts.inReplyTo;
  if (opts.references) mailOpts.references = opts.references;
  if (opts.headers) mailOpts.headers = opts.headers;

  const info = await transporter.sendMail(mailOpts);
  return { success: true, messageId: info.messageId };
}

// ── Main Send Function ─────────────────────────────────────────────────────

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  const supabase = createAdminClient();

  // Fetch account
  const { data: account, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("id", opts.accountId)
    .single();

  if (error || !account) {
    return { success: false, error: "Email account not found" };
  }

  if (account.status !== "active") {
    return { success: false, error: `Account is ${account.status}` };
  }

  // Check daily limit
  if (account.daily_sent_count >= account.daily_send_limit) {
    return { success: false, error: "Daily send limit reached" };
  }

  let result: SendResult;

  try {
    switch (account.provider) {
      case "gmail": {
        const token = await getValidAccessToken(account as Parameters<typeof getValidAccessToken>[0]);
        if (!token) {
          await supabase
            .from("email_accounts")
            .update({ status: "error", last_error: "OAuth token expired" })
            .eq("id", account.id);
          return { success: false, error: "Gmail token expired. Reconnect account." };
        }
        result = await sendViaGmail(token, account.email_address, opts);
        break;
      }
      case "microsoft": {
        const token = await getValidAccessToken(account as Parameters<typeof getValidAccessToken>[0]);
        if (!token) {
          await supabase
            .from("email_accounts")
            .update({ status: "error", last_error: "OAuth token expired" })
            .eq("id", account.id);
          return { success: false, error: "Microsoft token expired. Reconnect account." };
        }
        result = await sendViaMicrosoft(token, opts);
        break;
      }
      case "custom_imap": {
        result = await sendViaSMTP(
          account as unknown as Parameters<typeof sendViaSMTP>[0],
          opts,
        );
        break;
      }
      default:
        return { success: false, error: "Unknown provider" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await supabase
      .from("email_accounts")
      .update({ status: "error", last_error: message })
      .eq("id", account.id);
    return { success: false, error: message };
  }

  // Increment daily count on success
  if (result.success) {
    await supabase
      .from("email_accounts")
      .update({ daily_sent_count: account.daily_sent_count + 1 })
      .eq("id", account.id);
  }

  return result;
}
