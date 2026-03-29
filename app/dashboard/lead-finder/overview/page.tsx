"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UsersIcon,
  TargetIcon,
  CurrencyDollarIcon,
  SparkleIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  PlusIcon,
  LightningIcon,
  ChartBarIcon,
  ArrowRightIcon,
} from "@/components/ui";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

interface AnalyticsData {
  totalLeads: number;
  totalCampaigns: number;
  activeCampaigns: number;
  conversions: number;
  conversionRate: number;
  statusBreakdown: Record<string, number>;
  scoreDistribution: Record<string, number>;
  avgScore: number;
  leadsBySource: Record<string, number>;
  costs: {
    llm: number;
    apify: number;
    total: number;
    avgPerLead: number;
  };
  leadsOverTime: Record<string, number>;
  recentActivity: {
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }[];
}

// ── Colors ─────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  "#818cf8",
  "#34d399",
  "#f97316",
  "#f472b6",
  "#60a5fa",
  "#a78bfa",
  "#fbbf24",
  "#2dd4bf",
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: "bg-blue-400/10", text: "text-blue-400", label: "New" },
  enriching: { bg: "bg-amber-400/10", text: "text-amber-400", label: "Enriching" },
  qualified: { bg: "bg-purple-400/10", text: "text-purple-400", label: "Qualified" },
  converted: { bg: "bg-emerald-400/10", text: "text-emerald-400", label: "Converted" },
  declined: { bg: "bg-red-400/10", text: "text-red-400", label: "Declined" },
  archived: { bg: "bg-[#232329]", text: "text-[#a0a0a8]", label: "Archived" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  iconColor?: string;
}) {
  return (
    <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#a0a0a8] uppercase tracking-wider">{label}</span>
        <Icon size={16} className={iconColor || "text-[#a0a0a8]"} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-[#a0a0a8] mt-1">{sub}</p>}
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1f] border border-[#232329] rounded-lg p-3 shadow-xl">
      <p className="text-xs text-white font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function LeadFinderOverviewPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lead-finder/analytics")
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const scoreChartData = useMemo(() => {
    if (!data?.scoreDistribution) return [];
    return Object.entries(data.scoreDistribution).map(([range, count]) => ({
      range,
      count,
    }));
  }, [data]);

  const sourceChartData = useMemo(() => {
    if (!data?.leadsBySource) return [];
    return Object.entries(data.leadsBySource)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [data]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Finder</h1>
          <p className="text-sm text-[#a0a0a8] mt-1">Overview & analytics</p>
        </div>
        <Link
          href="/dashboard/lead-finder/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
        >
          <PlusIcon size={15} />
          New Campaign
        </Link>
      </div>

      <LeadFinderSubNav />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={32} className="animate-spin text-[#a0a0a8]" />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Leads"
              value={data.totalLeads.toLocaleString()}
              sub={`${data.activeCampaigns} active campaign${data.activeCampaigns !== 1 ? "s" : ""}`}
              icon={UsersIcon}
              iconColor="text-blue-400"
            />
            <KpiCard
              label="Active Campaigns"
              value={data.activeCampaigns}
              sub={`${data.totalCampaigns} total`}
              icon={TargetIcon}
              iconColor="text-purple-400"
            />
            <KpiCard
              label="Conversions"
              value={data.conversions.toLocaleString()}
              sub={`${data.conversionRate}% conversion rate`}
              icon={CheckCircleIcon}
              iconColor="text-emerald-400"
            />
            <KpiCard
              label="Total Cost"
              value={`$${data.costs.total.toFixed(4)}`}
              sub={`$${data.costs.avgPerLead.toFixed(4)} avg/lead`}
              icon={CurrencyDollarIcon}
              iconColor="text-amber-400"
            />
          </div>

          {/* Pipeline Status */}
          <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Pipeline Status</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(STATUS_STYLES).map(([status, style]) => {
                const count = data.statusBreakdown[status] ?? 0;
                return (
                  <div
                    key={status}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${style.bg}`}
                  >
                    <span className={`text-sm font-semibold ${style.text}`}>
                      {count.toLocaleString()}
                    </span>
                    <span className={`text-xs ${style.text} opacity-80`}>
                      {style.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score distribution */}
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ChartBarIcon size={15} className="text-[#a0a0a8]" />
                <h2 className="text-sm font-semibold text-white">Score Distribution</h2>
              </div>
              {scoreChartData.length === 0 || scoreChartData.every((d) => d.count === 0) ? (
                <div className="flex items-center justify-center h-40 text-[#a0a0a8] text-sm">
                  No scored leads yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232329" />
                    <XAxis dataKey="range" tick={{ fill: "#a0a0a8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#a0a0a8", fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Leads" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Leads by source */}
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <LightningIcon size={15} className="text-[#a0a0a8]" />
                <h2 className="text-sm font-semibold text-white">Leads by Source</h2>
              </div>
              {sourceChartData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-[#a0a0a8] text-sm">
                  No leads yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={sourceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {sourceChartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number | undefined) => [v ?? 0, "Leads"]}
                      contentStyle={{
                        background: "#1a1a1f",
                        border: "1px solid #232329",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, color: "#a0a0a8" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Cost breakdown + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost breakdown */}
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CurrencyDollarIcon size={15} className="text-[#a0a0a8]" />
                <h2 className="text-sm font-semibold text-white">Cost Breakdown</h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Apify (scraping)", value: data.costs.apify, color: "bg-blue-400" },
                  { label: "LLM (AI enrichment)", value: data.costs.llm, color: "bg-purple-400" },
                ].map((item) => {
                  const pct =
                    data.costs.total > 0
                      ? Math.round((item.value / data.costs.total) * 100)
                      : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[#a0a0a8]">{item.label}</span>
                        <span className="text-white font-medium">
                          ${item.value.toFixed(4)}
                          <span className="text-[#a0a0a8] font-normal ml-1">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#232329] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-[#232329] flex items-center justify-between text-xs">
                  <span className="text-[#a0a0a8]">Total</span>
                  <span className="text-white font-semibold">
                    ${data.costs.total.toFixed(4)}
                  </span>
                </div>
                <Link
                  href="/dashboard/lead-finder/costs"
                  className="flex items-center gap-1.5 text-xs text-[#a0a0a8] hover:text-white transition-colors pt-1"
                >
                  View full cost report
                  <ArrowRightIcon size={12} />
                </Link>
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <SparkleIcon size={15} className="text-[#a0a0a8]" />
                <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
              </div>
              {data.recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <p className="text-sm text-[#a0a0a8]">No activity yet</p>
                  <Link
                    href="/dashboard/lead-finder/campaigns/new"
                    className="text-xs text-white underline underline-offset-2 hover:no-underline"
                  >
                    Create your first campaign
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentActivity.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                          event.type === "discovery_success"
                            ? "bg-emerald-400"
                            : event.type === "lead_added"
                            ? "bg-blue-400"
                            : "bg-[#a0a0a8]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white leading-snug truncate">
                          {event.description}
                        </p>
                        <p className="text-xs text-[#a0a0a8] mt-0.5">
                          {timeAgo(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          {data.totalLeads === 0 && data.totalCampaigns === 0 && (
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-6 text-center">
              <h2 className="text-base font-semibold text-white mb-2">
                Get started with Lead Finder
              </h2>
              <p className="text-sm text-[#a0a0a8] mb-4">
                Create a campaign to start discovering and enriching leads automatically.
              </p>
              <Link
                href="/dashboard/lead-finder/campaigns/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
              >
                <PlusIcon size={15} />
                Create Campaign
              </Link>
            </div>
          )}
        </div>
      )}

      {!loading && !data && (
        <div className="flex items-center justify-center py-24 text-[#a0a0a8] text-sm">
          Failed to load analytics.
        </div>
      )}
    </div>
  );
}
