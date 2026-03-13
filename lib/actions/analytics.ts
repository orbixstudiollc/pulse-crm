"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";

// ── Pipeline Velocity ────────────────────────────────────────────────────────

export async function getPipelineVelocity() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: deals } = await supabase
    .from("deals")
    .select("stage, value, created_at, updated_at")
    .eq("organization_id", orgId);

  if (!deals || deals.length === 0)
    return { data: { stages: [], totalDeals: 0, avgDealValue: 0 } };

  const stageCounts: Record<string, { count: number; totalValue: number }> = {};
  const stages = ["discovery", "proposal", "negotiation", "closed_won", "closed_lost"];

  for (const stage of stages) {
    const stageDeals = deals.filter((d) => d.stage === stage);
    stageCounts[stage] = {
      count: stageDeals.length,
      totalValue: stageDeals.reduce((s, d) => s + (d.value || 0), 0),
    };
  }

  const avgDealValue =
    deals.length > 0
      ? Math.round(deals.reduce((s, d) => s + (d.value || 0), 0) / deals.length)
      : 0;

  return {
    data: {
      stages: stages.map((s) => ({
        stage: s,
        count: stageCounts[s]?.count || 0,
        totalValue: stageCounts[s]?.totalValue || 0,
      })),
      totalDeals: deals.length,
      avgDealValue,
    },
  };
}

// ── Lead Source Performance ──────────────────────────────────────────────────

export async function getLeadSourcePerformance() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: leads } = await supabase
    .from("leads")
    .select("source, score, status")
    .eq("organization_id", orgId);

  if (!leads || leads.length === 0) return { data: [] };

  const sourceMap: Record<
    string,
    { count: number; totalScore: number; hotCount: number }
  > = {};

  for (const lead of leads) {
    const source = lead.source || "Unknown";
    if (!sourceMap[source]) {
      sourceMap[source] = { count: 0, totalScore: 0, hotCount: 0 };
    }
    sourceMap[source].count++;
    sourceMap[source].totalScore += lead.score || 0;
    if (lead.status === "hot") sourceMap[source].hotCount++;
  }

  const result = Object.entries(sourceMap).map(([source, stats]) => ({
    source,
    count: stats.count,
    avgScore: Math.round(stats.totalScore / stats.count),
    hotRate: Math.round((stats.hotCount / stats.count) * 100),
  }));

  return { data: result.sort((a, b) => b.avgScore - a.avgScore) };
}

// ── Sales Forecast ──────────────────────────────────────────────────────────

export async function getSalesForecast() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: deals } = await supabase
    .from("deals")
    .select("stage, value, probability, close_date")
    .eq("organization_id", orgId)
    .not("stage", "in", '("closed_won","closed_lost")');

  if (!deals || deals.length === 0) return { data: { weighted: 0, deals: [] } };

  const weighted = deals.reduce(
    (sum, d) => sum + ((d.value || 0) * (d.probability || 0)) / 100,
    0,
  );

  return {
    data: {
      weighted: Math.round(weighted),
      deals: deals.map((d) => ({
        stage: d.stage,
        value: d.value || 0,
        probability: d.probability || 0,
        weightedValue: Math.round(
          ((d.value || 0) * (d.probability || 0)) / 100,
        ),
        expectedClose: d.close_date,
      })),
    },
  };
}

// ── Win/Loss Analysis ───────────────────────────────────────────────────────

export async function getWinLossAnalysis() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: deals } = await supabase
    .from("deals")
    .select("stage, value, created_at, updated_at")
    .eq("organization_id", orgId)
    .in("stage", ["closed_won", "closed_lost"]);

  if (!deals || deals.length === 0)
    return { data: { won: 0, lost: 0, winRate: 0, avgWonValue: 0, avgLostValue: 0 } };

  const won = deals.filter((d) => d.stage === "closed_won");
  const lost = deals.filter((d) => d.stage === "closed_lost");

  const avgWonValue =
    won.length > 0
      ? Math.round(won.reduce((s, d) => s + (d.value || 0), 0) / won.length)
      : 0;
  const avgLostValue =
    lost.length > 0
      ? Math.round(lost.reduce((s, d) => s + (d.value || 0), 0) / lost.length)
      : 0;

  return {
    data: {
      won: won.length,
      lost: lost.length,
      winRate:
        deals.length > 0 ? Math.round((won.length / deals.length) * 100) : 0,
      avgWonValue,
      avgLostValue,
    },
  };
}

// ── Activity Metrics ────────────────────────────────────────────────────────

export async function getActivityMetrics(days: number = 30) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: activities } = await supabase
    .from("activities")
    .select("type, created_at")
    .eq("organization_id", orgId)
    .gte("created_at", since.toISOString());

  if (!activities || activities.length === 0) return { data: { total: 0, byType: {} } };

  const byType: Record<string, number> = {};
  for (const act of activities) {
    const t = act.type || "other";
    byType[t] = (byType[t] || 0) + 1;
  }

  return {
    data: {
      total: activities.length,
      byType,
    },
  };
}

// ── Conversion Funnel ───────────────────────────────────────────────────────

export async function getConversionFunnel() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const [leadsRes, dealsRes, customersRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
  ]);

  const totalLeads = leadsRes.count || 0;
  const totalDeals = dealsRes.count || 0;
  const totalCustomers = customersRes.count || 0;

  return {
    data: {
      leads: totalLeads,
      deals: totalDeals,
      customers: totalCustomers,
      leadToDealRate:
        totalLeads > 0 ? Math.round((totalDeals / totalLeads) * 100) : 0,
      dealToCustomerRate:
        totalDeals > 0 ? Math.round((totalCustomers / totalDeals) * 100) : 0,
    },
  };
}

// ── Sequence Performance ────────────────────────────────────────────────────

export async function getSequencePerformance() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: sequences } = await supabase
    .from("sequences")
    .select("id, name, status, total_enrolled, reply_rate")
    .eq("organization_id", orgId)
    .order("total_enrolled", { ascending: false });

  if (!sequences || sequences.length === 0) return { data: [] };

  return { data: sequences };
}

// ── ICP Performance ─────────────────────────────────────────────────────────

export async function getICPPerformance() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: profiles } = await supabase
    .from("icp_profiles")
    .select("id, name, color")
    .eq("organization_id", orgId);

  if (!profiles || profiles.length === 0) return { data: [] };

  const { data: leads } = await supabase
    .from("leads")
    .select("icp_profile_id, icp_match_score, status")
    .eq("organization_id", orgId)
    .not("icp_profile_id", "is", null);

  const result = profiles.map((p) => {
    const matchedLeads = (leads || []).filter(
      (l) => l.icp_profile_id === p.id,
    );
    const hotLeads = matchedLeads.filter((l) => l.status === "hot");
    const avgScore =
      matchedLeads.length > 0
        ? Math.round(
            matchedLeads.reduce((s, l) => s + (l.icp_match_score || 0), 0) /
              matchedLeads.length,
          )
        : 0;

    return {
      profileId: p.id,
      name: p.name,
      color: p.color,
      matchedLeads: matchedLeads.length,
      hotLeads: hotLeads.length,
      avgMatchScore: avgScore,
    };
  });

  return { data: result };
}

// ── Channel Analytics (Multi-Channel Performance) ────────────────────────────

export async function getChannelAnalytics(days: number = 30) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  // Fetch all three channel data in parallel
  const [emailRes, waRes, liRes, emailDailyRes, waDailyRes, liDailyRes] =
    await Promise.all([
      // Email totals from sequence_events
      supabase
        .from("sequence_events")
        .select(
          "id, event_type, created_at, sequence_enrollments!inner(leads!inner(organization_id))"
        )
        .eq("sequence_enrollments.leads.organization_id", orgId)
        .in("event_type", [
          "email_sent",
          "email_opened",
          "email_clicked",
          "email_replied",
          "email_bounced",
        ])
        .gte("created_at", sinceISO),

      // WhatsApp message totals
      supabase
        .from("whatsapp_messages")
        .select("id, status, direction, message_type, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", sinceISO),

      // LinkedIn action totals
      supabase
        .from("linkedin_actions")
        .select("id, action_type, status, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", sinceISO),

      // Email daily volume (last N days)
      supabase
        .from("sequence_events")
        .select(
          "created_at, event_type, sequence_enrollments!inner(leads!inner(organization_id))"
        )
        .eq("sequence_enrollments.leads.organization_id", orgId)
        .eq("event_type", "email_sent")
        .gte("created_at", sinceISO),

      // WhatsApp daily volume
      supabase
        .from("whatsapp_messages")
        .select("created_at")
        .eq("organization_id", orgId)
        .gte("created_at", sinceISO),

      // LinkedIn daily volume
      supabase
        .from("linkedin_actions")
        .select("created_at")
        .eq("organization_id", orgId)
        .gte("created_at", sinceISO),
    ]);

  // --- Email breakdown ---
  const emails = (emailRes.data || []) as { id: string; event_type: string; created_at: string }[];
  const emailSent = emails.filter((e) => e.event_type === "email_sent").length;
  const emailOpened = emails.filter((e) => e.event_type === "email_opened").length;
  const emailClicked = emails.filter((e) => e.event_type === "email_clicked").length;
  const emailReplied = emails.filter((e) => e.event_type === "email_replied").length;
  const emailBounced = emails.filter((e) => e.event_type === "email_bounced").length;

  // --- WhatsApp breakdown ---
  const waMessages = (waRes.data || []) as {
    id: string;
    status: string;
    direction: string;
    message_type: string;
    created_at: string;
  }[];
  const waSent = waMessages.filter((m) => m.direction === "outbound").length;
  const waDelivered = waMessages.filter((m) => m.status === "delivered").length;
  const waRead = waMessages.filter((m) => m.status === "read").length;
  const waReplied = waMessages.filter((m) => m.direction === "inbound").length;
  const waFailed = waMessages.filter((m) => m.status === "failed").length;

  // --- LinkedIn breakdown ---
  const liActions = (liRes.data || []) as {
    id: string;
    action_type: string;
    status: string;
    created_at: string;
  }[];
  const liConnect = liActions.filter((a) => a.action_type === "connect").length;
  const liMessage = liActions.filter((a) => a.action_type === "message").length;
  const liViews = liActions.filter((a) => a.action_type === "view_profile").length;
  const liEndorse = liActions.filter((a) => a.action_type === "endorse").length;
  const liAccepted = liActions.filter((a) => a.status === "accepted").length;
  const liReplied = liActions.filter((a) => a.status === "replied").length;

  // --- Daily volume per channel ---
  function groupByDay(items: { created_at: string }[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const item of items) {
      const day = item.created_at.slice(0, 10); // YYYY-MM-DD
      map[day] = (map[day] || 0) + 1;
    }
    return map;
  }

  const emailDaily = groupByDay((emailDailyRes.data || []) as { created_at: string }[]);
  const waDaily = groupByDay((waDailyRes.data || []) as { created_at: string }[]);
  const liDaily = groupByDay((liDailyRes.data || []) as { created_at: string }[]);

  // Merge all days
  const allDays = new Set([
    ...Object.keys(emailDaily),
    ...Object.keys(waDaily),
    ...Object.keys(liDaily),
  ]);
  const dailyVolume = Array.from(allDays)
    .sort()
    .map((day) => ({
      date: day,
      email: emailDaily[day] || 0,
      whatsapp: waDaily[day] || 0,
      linkedin: liDaily[day] || 0,
    }));

  return {
    data: {
      email: {
        total: emails.length,
        sent: emailSent,
        opened: emailOpened,
        clicked: emailClicked,
        replied: emailReplied,
        bounced: emailBounced,
        openRate: emailSent > 0 ? Math.round((emailOpened / emailSent) * 100) : 0,
        clickRate: emailSent > 0 ? Math.round((emailClicked / emailSent) * 100) : 0,
        replyRate: emailSent > 0 ? Math.round((emailReplied / emailSent) * 100) : 0,
      },
      whatsapp: {
        total: waMessages.length,
        sent: waSent,
        delivered: waDelivered,
        read: waRead,
        replied: waReplied,
        failed: waFailed,
        deliveryRate: waSent > 0 ? Math.round((waDelivered / waSent) * 100) : 0,
        readRate: waSent > 0 ? Math.round((waRead / waSent) * 100) : 0,
        replyRate: waSent > 0 ? Math.round((waReplied / waSent) * 100) : 0,
      },
      linkedin: {
        total: liActions.length,
        connections: liConnect,
        messages: liMessage,
        profileViews: liViews,
        endorsements: liEndorse,
        accepted: liAccepted,
        replied: liReplied,
        acceptRate: liConnect > 0 ? Math.round((liAccepted / liConnect) * 100) : 0,
        replyRate: liMessage > 0 ? Math.round((liReplied / liMessage) * 100) : 0,
      },
      dailyVolume,
      summary: {
        totalOutreach: emailSent + waSent + liActions.length,
        totalReplies: emailReplied + waReplied + liReplied,
        overallReplyRate:
          emailSent + waSent + liMessage > 0
            ? Math.round(
                ((emailReplied + waReplied + liReplied) /
                  (emailSent + waSent + liMessage)) *
                  100
              )
            : 0,
        bestChannel:
          emailReplied >= waReplied && emailReplied >= liReplied
            ? "email"
            : waReplied >= liReplied
              ? "whatsapp"
              : "linkedin",
      },
    },
  };
}
