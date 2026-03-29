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
import { PageHeader, StatCard } from "@/components/dashboard";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";
import { Button } from "@/components/ui";
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
  costs: { llm: number; apify: number; total: number; avgPerLead: number };
  leadsOverTime: Record<string, number>;
  recentActivity: { id: string; type: string; description: string; timestamp: string }[];
}

// ── Colors ─────────────────────────────────────────────────────────────────

const PIE_COLORS = ["#818cf8", "#34d399", "#f97316", "#f472b6", "#60a5fa", "#a78bfa", "#fbbf24", "#2dd4bf"];

const STATUS_CONFIG: Record<string, { dot: string; label: string; bg: string; text: string }> = {
  new: { dot: "bg-blue-500", label: "New", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
  enriching: { dot: "bg-amber-500", label: "Enriching", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
  qualified: { dot: "bg-violet-500", label: "Qualified", bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400" },
  converted: { dot: "bg-green-500", label: "Converted", bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400" },
  declined: { dot: "bg-red-500", label: "Declined", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400" },
  archived: { dot: "bg-neutral-400", label: "Archived", bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-600 dark:text-neutral-400" },
};

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

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      {payload.map((e, i) => (
        <p key={i} className="text-sm font-semibold text-neutral-950 dark:text-neutral-50" style={{ color: e.color }}>{e.name}: {e.value}</p>
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
    return Object.entries(data.scoreDistribution).map(([range, count]) => ({ range, count }));
  }, [data]);

  const sourceChartData = useMemo(() => {
    if (!data?.leadsBySource) return [];
    return Object.entries(data.leadsBySource).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [data]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader title="Lead Finder">
        <Link href="/dashboard/lead-finder/campaigns/new">
          <Button leftIcon={<PlusIcon size={15} />}>New Campaign</Button>
        </Link>
      </PageHeader>

      <LeadFinderSubNav />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-neutral-400" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Leads"
              value={data.totalLeads.toLocaleString()}
              icon={<UsersIcon size={20} className="text-neutral-500 dark:text-neutral-400" />}
              change={{ value: `${data.activeCampaigns} active campaign${data.activeCampaigns !== 1 ? "s" : ""}`, trend: "neutral" }}
            />
            <StatCard
              label="Active Campaigns"
              value={data.activeCampaigns}
              icon={<TargetIcon size={20} className="text-neutral-500 dark:text-neutral-400" />}
              change={{ value: `${data.totalCampaigns} total`, trend: "neutral" }}
            />
            <StatCard
              label="Conversions"
              value={data.conversions.toLocaleString()}
              icon={<CheckCircleIcon size={20} className="text-neutral-500 dark:text-neutral-400" />}
              change={{ value: `${data.conversionRate}% conversion rate`, trend: data.conversionRate > 0 ? "up" : "neutral" }}
            />
            <StatCard
              label="Total Cost"
              value={`$${data.costs.total.toFixed(4)}`}
              icon={<CurrencyDollarIcon size={20} className="text-neutral-500 dark:text-neutral-400" />}
              change={{ value: `$${data.costs.avgPerLead.toFixed(4)} avg/lead`, trend: "neutral" }}
            />
          </div>

          {/* Pipeline Status */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4">Pipeline Status</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                const count = data.statusBreakdown[status] ?? 0;
                return (
                  <div key={status} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    <span className={`text-sm font-semibold ${cfg.text}`}>{count.toLocaleString()}</span>
                    <span className={`text-xs ${cfg.text} opacity-75`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ChartBarIcon size={15} className="text-neutral-400 dark:text-neutral-500" />
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Score Distribution</h2>
              </div>
              {scoreChartData.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="text-neutral-200 dark:text-neutral-800" stroke="currentColor" vertical={false} />
                    <XAxis dataKey="range" tick={{ fill: "currentColor", fontSize: 11 }} className="text-neutral-500 dark:text-neutral-400" />
                    <YAxis tick={{ fill: "currentColor", fontSize: 11 }} className="text-neutral-500 dark:text-neutral-400" allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Leads" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-neutral-400 dark:text-neutral-500">No scored leads yet</div>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <LightningIcon size={15} className="text-neutral-400 dark:text-neutral-500" />
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Leads by Source</h2>
              </div>
              {sourceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sourceChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {sourceChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number | undefined) => [v ?? 0, "Leads"]} contentStyle={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-neutral-400 dark:text-neutral-500">No leads yet</div>
              )}
            </div>
          </div>

          {/* Cost breakdown + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CurrencyDollarIcon size={15} className="text-neutral-400 dark:text-neutral-500" />
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Cost Breakdown</h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Apify (scraping)", value: data.costs.apify, color: "bg-blue-500" },
                  { label: "LLM (AI enrichment)", value: data.costs.llm, color: "bg-violet-500" },
                ].map((item) => {
                  const pct = data.costs.total > 0 ? Math.round((item.value / data.costs.total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-neutral-500 dark:text-neutral-400">{item.label}</span>
                        <span className="text-neutral-950 dark:text-neutral-50 font-medium">
                          ${item.value.toFixed(4)} <span className="text-neutral-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">Total</span>
                  <span className="text-neutral-950 dark:text-neutral-50 font-semibold">${data.costs.total.toFixed(4)}</span>
                </div>
                <Link href="/dashboard/lead-finder/costs" className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-50 transition-colors pt-1">
                  View full cost report <ArrowRightIcon size={12} />
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <SparkleIcon size={15} className="text-neutral-400 dark:text-neutral-500" />
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Recent Activity</h2>
              </div>
              {data.recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">No activity yet</p>
                  <Link href="/dashboard/lead-finder/campaigns/new" className="text-xs text-neutral-950 dark:text-neutral-50 underline underline-offset-2">Create your first campaign</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentActivity.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${event.type === "discovery_success" ? "bg-green-500" : event.type === "lead_added" ? "bg-blue-500" : "bg-neutral-400"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-neutral-950 dark:text-neutral-50 leading-snug truncate">{event.description}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{timeAgo(event.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {data.totalLeads === 0 && data.totalCampaigns === 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center">
              <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mb-2">Get started with Lead Finder</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Create a campaign to start discovering and enriching leads automatically.</p>
              <Link href="/dashboard/lead-finder/campaigns/new">
                <Button leftIcon={<PlusIcon size={15} />}>Create Campaign</Button>
              </Link>
            </div>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="flex items-center justify-center py-24 text-sm text-neutral-400 dark:text-neutral-500">Failed to load analytics.</div>
      )}
    </div>
  );
}
