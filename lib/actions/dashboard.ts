"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";

// ── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Parallel queries for all stats
  const [customersRes, leadsRes, dealsRes, activitiesRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("deals")
      .select("id, value, stage")
      .eq("organization_id", orgId),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
  ]);

  const totalCustomers = customersRes.count ?? 0;
  const totalLeads = leadsRes.count ?? 0;
  const totalActivities = activitiesRes.count ?? 0;

  const deals = dealsRes.data ?? [];
  const totalRevenue = deals.reduce(
    (sum, deal) => sum + (deal.value || 0),
    0,
  );
  const activeDeals = deals.filter(
    (d) => d.stage !== "closed_won" && d.stage !== "closed_lost",
  ).length;

  return {
    data: {
      totalCustomers,
      totalLeads,
      totalRevenue,
      activeDeals,
      totalActivities,
      totalDeals: deals.length,
    },
  };
}

// ── Revenue Chart Data ───────────────────────────────────────────────────────

export async function getRevenueChartData(months: number = 12) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get deals created in the last N months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data: deals, error } = await supabase
    .from("deals")
    .select("value, stage, created_at")
    .eq("organization_id", orgId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, data: [] };

  // Group by month
  const monthlyData: Record<string, { revenue: number; deals: number }> = {};

  for (const deal of deals ?? []) {
    const date = new Date(deal.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData[key]) {
      monthlyData[key] = { revenue: 0, deals: 0 };
    }

    monthlyData[key].revenue += deal.value || 0;
    monthlyData[key].deals += 1;
  }

  // Convert to array with labels
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const chartData = Object.entries(monthlyData).map(([key, value]) => {
    const [year, month] = key.split("-");
    return {
      month: `${monthNames[parseInt(month) - 1]} ${year}`,
      revenue: value.revenue,
      deals: value.deals,
    };
  });

  return { data: chartData };
}

// ── Active Deals (Pipeline) ─────────────────────────────────────────────────

export async function getActiveDeals(limit: number = 5) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("organization_id", orgId)
    .not("stage", "in", '("closed_won","closed_lost")')
    .order("value", { ascending: false })
    .limit(limit);

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Active Deals by Stage (Pipeline Breakdown) ─────────────────────────────

export async function getActiveDealsByStage() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: deals, error } = await supabase
    .from("deals")
    .select("value, stage")
    .eq("organization_id", orgId)
    .not("stage", "in", '("closed_won","closed_lost")');

  if (error) return { error: error.message, data: [] };

  const stageConfig: Record<string, { label: string; color: string }> = {
    discovery: { label: "Discovery", color: "bg-blue-500" },
    proposal: { label: "Proposal", color: "bg-violet-500" },
    negotiation: { label: "Negotiation", color: "bg-[#f0b100]" },
  };

  const stageMap: Record<string, { value: number; count: number }> = {};
  for (const deal of deals ?? []) {
    if (!stageMap[deal.stage]) stageMap[deal.stage] = { value: 0, count: 0 };
    stageMap[deal.stage].value += deal.value || 0;
    stageMap[deal.stage].count += 1;
  }

  const stages = Object.entries(stageMap).map(([stage, data]) => ({
    name: stageConfig[stage]?.label || stage,
    value: data.value,
    count: data.count,
    color: stageConfig[stage]?.color || "bg-neutral-500",
  }));

  return { data: stages };
}

// ── Latest Leads ─────────────────────────────────────────────────────────────

export async function getLatestLeads(limit: number = 5) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Activity Feed ────────────────────────────────────────────────────────────

export async function getActivityFeed(limit: number = 10) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}
