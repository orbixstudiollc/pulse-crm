"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";

// ── Types ──────────────────────────────────────────────────────────────────

export interface EmailOverviewStats {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

export interface AccountHealth {
  id: string;
  email: string;
  provider: string;
  dailySent: number;
  dailySendLimit: number;
  totalSent: number;
  openRate: number;
  bounceRate: number;
  status: string;
}

export interface DailyEmailVolume {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}

// ── Get Email Overview Stats ──────────────────────────────────────────────

export async function getEmailOverviewStats(): Promise<{
  data: EmailOverviewStats;
  error?: string;
}> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get counts by status
  const { data: messages } = await supabase
    .from("email_messages")
    .select("status, open_count, click_count")
    .eq("organization_id", orgId)
    .eq("direction", "outbound");

  if (!messages) {
    return {
      data: {
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalReplied: 0,
        totalBounced: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        bounceRate: 0,
      },
    };
  }

  const totalSent = messages.length;
  const totalDelivered = messages.filter((m) =>
    ["delivered", "opened", "clicked", "replied"].includes(m.status),
  ).length;
  const totalOpened = messages.filter((m) =>
    ["opened", "clicked", "replied"].includes(m.status),
  ).length;
  const totalClicked = messages.filter((m) =>
    ["clicked", "replied"].includes(m.status),
  ).length;
  const totalReplied = messages.filter(
    (m) => m.status === "replied",
  ).length;
  const totalBounced = messages.filter(
    (m) => m.status === "bounced",
  ).length;

  return {
    data: {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalReplied,
      totalBounced,
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
      clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
      replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
      bounceRate:
        totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0,
    },
  };
}

// ── Get Account Health ────────────────────────────────────────────────────

export async function getAccountHealth(): Promise<{
  data: AccountHealth[];
  error?: string;
}> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: accounts } = await supabase
    .from("email_accounts")
    .select("id, email_address, provider, daily_sent_count, daily_send_limit, status")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (!accounts) return { data: [] };

  const result: AccountHealth[] = [];

  for (const acc of accounts) {
    // Get message stats for this account
    const { data: msgs } = await supabase
      .from("email_messages")
      .select("status")
      .eq("email_account_id", acc.id)
      .eq("direction", "outbound");

    const total = msgs?.length || 0;
    const opened = msgs?.filter((m) =>
      ["opened", "clicked", "replied"].includes(m.status),
    ).length || 0;
    const bounced = msgs?.filter((m) => m.status === "bounced").length || 0;

    result.push({
      id: acc.id,
      email: acc.email_address,
      provider: acc.provider,
      dailySent: acc.daily_sent_count,
      dailySendLimit: acc.daily_send_limit,
      totalSent: total,
      openRate: total > 0 ? Math.round((opened / total) * 100) : 0,
      bounceRate: total > 0 ? Math.round((bounced / total) * 100) : 0,
      status: acc.status,
    });
  }

  return { data: result };
}

// ── Get Daily Volume (last 30 days) ───────────────────────────────────────

export async function getDailyEmailVolume(): Promise<{
  data: DailyEmailVolume[];
  error?: string;
}> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: messages } = await supabase
    .from("email_messages")
    .select("status, created_at")
    .eq("organization_id", orgId)
    .eq("direction", "outbound")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  if (!messages) return { data: [] };

  // Group by date
  const dayMap = new Map<
    string,
    { sent: number; opened: number; clicked: number; replied: number }
  >();

  for (const msg of messages) {
    const date = msg.created_at.split("T")[0];
    const entry = dayMap.get(date) || {
      sent: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
    };
    entry.sent++;
    if (["opened", "clicked", "replied"].includes(msg.status)) entry.opened++;
    if (["clicked", "replied"].includes(msg.status)) entry.clicked++;
    if (msg.status === "replied") entry.replied++;
    dayMap.set(date, entry);
  }

  const result: DailyEmailVolume[] = [];
  for (const [date, counts] of dayMap) {
    result.push({ date, ...counts });
  }

  return { data: result };
}
