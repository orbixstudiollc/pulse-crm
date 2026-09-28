"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
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
import { EnrichmentProgressBanner } from "@/components/lead-finder/EnrichmentProgressBanner";
import { useLeadEvents } from "@/hooks/use-lead-events";
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
import { axisTick, chartAccent, chartGrid, chartSeries, chartTooltipStyle } from "@/lib/design-system/chart-colors";

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

const STATUS_CONFIG: Record<string, { dot: string; label: string; bg: string; text: string }> = {
  new: { dot: "bg-accent-strong", label: "New", bg: "bg-accent-surface", text: "text-accent-strong" },
  enriching: { dot: "bg-warning", label: "Enriching", bg: "bg-warning-surface", text: "text-warning" },
  qualified: { dot: "bg-accent-strong", label: "Qualified", bg: "bg-accent-surface", text: "text-accent-strong" },
  converted: { dot: "bg-success", label: "Converted", bg: "bg-success-surface", text: "text-success" },
  declined: { dot: "bg-danger", label: "Declined", bg: "bg-danger-surface", text: "text-danger" },
  archived: { dot: "bg-fg-muted", label: "Archived", bg: "bg-muted", text: "text-fg-secondary" },
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
    <div className="rounded-md border border-line bg-surface px-3 py-2 shadow-dropdown">
      <p className="text-xs font-medium text-fg-secondary mb-1">{label}</p>
      {payload.map((e, i) => (
        <p key={i} className="text-sm font-semibold text-fg" style={{ color: e.color }}>{e.name}: {e.value}</p>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  leadCount: number;
  enrichedCount: number;
  avgScore: number;
  target_niche?: string | null;
  schedule_frequency?: string | null;
  auto_enrich?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
}

function campaignStatusClass(status: string): string {
  switch (status) {
    case "active":
      return "text-success bg-success-surface";
    case "paused":
      return "text-warning bg-warning-surface";
    case "completed":
      return "text-accent-on-surface bg-accent-surface";
    default:
      return "text-fg-secondary bg-muted";
  }
}

export default function LeadFinderOverviewPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const pendingLeadsRef = useRef(0);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshAnalytics = useMemo(
    () => () =>
      fetch("/api/lead-finder/analytics")
        .then((r) => r.json())
        .then((j) => setData(j.data ?? null))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    Promise.all([
      refreshAnalytics(),
      fetch("/api/lead-finder/campaigns")
        .then((r) => r.json())
        .then((j) => {
          const list = Array.isArray(j?.data) ? j.data : [];
          setCampaigns(list);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [refreshAnalytics]);

  // ── Live updates via SSE ───────────────────────────────────────────────

  useLeadEvents({
    onLeadDiscovered: () => {
      // Increment local total leads + batch "+N new leads" toasts.
      setData((prev) =>
        prev ? { ...prev, totalLeads: prev.totalLeads + 1 } : prev
      );
      pendingLeadsRef.current += 1;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(() => {
        const n = pendingLeadsRef.current;
        pendingLeadsRef.current = 0;
        if (n > 0) {
          toast.success(`+${n} new lead${n === 1 ? "" : "s"} discovered`);
        }
      }, 1_500);
    },
    onLeadEnrichmentCompleted: () => {
      void refreshAnalytics();
    },
    onDiscoveryCompleted: () => {
      void refreshAnalytics();
    },
  });

  const scoreChartData = useMemo(() => {
    if (!data?.scoreDistribution) return [];
    return Object.entries(data.scoreDistribution).map(([range, count]) => ({ range, count }));
  }, [data]);

  const sourceChartData = useMemo(() => {
    if (!data?.leadsBySource) return [];
    return Object.entries(data.leadsBySource).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [data]);

  return (
    <div className="p-6 lg:p-6 space-y-6">
      <PageHeader title="Lead Finder">
        <Link href="/dashboard/lead-finder/campaigns/new">
          <Button leftIcon={<PlusIcon size={15} />}>New Campaign</Button>
        </Link>
      </PageHeader>

      <LeadFinderSubNav />

      <EnrichmentProgressBanner onBatchFinished={() => void refreshAnalytics()} />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-fg-muted" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Leads"
              value={data.totalLeads.toLocaleString()}
              icon={<UsersIcon size={20} className="text-fg-secondary" />}
              change={{ value: `${data.activeCampaigns} active campaign${data.activeCampaigns !== 1 ? "s" : ""}`, trend: "neutral" }}
            />
            <StatCard
              label="Active Campaigns"
              value={data.activeCampaigns}
              icon={<TargetIcon size={20} className="text-fg-secondary" />}
              change={{ value: `${data.totalCampaigns} total`, trend: "neutral" }}
            />
            <StatCard
              label="Conversions"
              value={data.conversions.toLocaleString()}
              icon={<CheckCircleIcon size={20} className="text-fg-secondary" />}
              change={{ value: `${data.conversionRate}% conversion rate`, trend: data.conversionRate > 0 ? "up" : "neutral" }}
            />
            <StatCard
              label="Total Cost"
              value={`$${data.costs.total.toFixed(4)}`}
              icon={<CurrencyDollarIcon size={20} className="text-fg-secondary" />}
              change={{ value: `$${data.costs.avgPerLead.toFixed(4)} avg/lead`, trend: "neutral" }}
            />
          </div>

          {/* Pipeline Status */}
          <div className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg mb-4">Pipeline Status</h2>
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
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-4">
                <ChartBarIcon size={15} className="text-fg-muted" />
                <h2 className="text-sm font-semibold text-fg">Score Distribution</h2>
              </div>
              {scoreChartData.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="range" tick={axisTick} />
                    <YAxis tick={axisTick} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Leads" fill={chartAccent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-fg-secondary">No scored leads yet</div>
              )}
            </div>

            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-4">
                <LightningIcon size={15} className="text-fg-muted" />
                <h2 className="text-sm font-semibold text-fg">Leads by Source</h2>
              </div>
              {sourceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sourceChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {sourceChartData.map((_, i) => <Cell key={i} fill={chartSeries[i % chartSeries.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number | undefined) => [v ?? 0, "Leads"]} contentStyle={chartTooltipStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-fg-secondary">No leads yet</div>
              )}
            </div>
          </div>

          {/* Cost breakdown + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-4">
                <CurrencyDollarIcon size={15} className="text-fg-muted" />
                <h2 className="text-sm font-semibold text-fg">Cost Breakdown</h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Apify (scraping)", value: data.costs.apify, color: "bg-accent-strong" },
                  { label: "LLM (AI enrichment)", value: data.costs.llm, color: "bg-accent-strong" },
                ].map((item) => {
                  const pct = data.costs.total > 0 ? Math.round((item.value / data.costs.total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-fg-secondary">{item.label}</span>
                        <span className="text-fg font-medium">
                          ${item.value.toFixed(4)} <span className="text-fg-muted font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                  <span className="text-fg-secondary">Total</span>
                  <span className="text-fg font-semibold">${data.costs.total.toFixed(4)}</span>
                </div>
                <Link href="/dashboard/lead-finder/costs" className="flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg transition-colors pt-1">
                  View full cost report <ArrowRightIcon size={12} />
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-4">
                <SparkleIcon size={15} className="text-fg-muted" />
                <h2 className="text-sm font-semibold text-fg">Recent Activity</h2>
              </div>
              {data.recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <p className="text-sm text-fg-secondary">No activity yet</p>
                  <Link href="/dashboard/lead-finder/campaigns/new" className="text-xs text-fg underline underline-offset-2">Create your first campaign</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentActivity.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${event.type === "discovery_success" ? "bg-success" : event.type === "lead_added" ? "bg-accent-strong" : "bg-fg-muted"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-fg leading-snug truncate">{event.description}</p>
                        <p className="text-xs text-fg-secondary mt-0.5">{timeAgo(event.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Per-campaign mini-cards */}
          {campaigns.length > 0 && (
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TargetIcon size={15} className="text-fg-muted" />
                  <h2 className="text-sm font-semibold text-fg">Campaigns</h2>
                </div>
                <Link
                  href="/dashboard/lead-finder/campaigns"
                  className="flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg transition-colors"
                >
                  View all <ArrowRightIcon size={12} />
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.slice(0, 6).map((campaign) => {
                  const newCount = Math.max(
                    0,
                    (campaign.leadCount ?? 0) - (campaign.enrichedCount ?? 0)
                  );
                  return (
                    <Link
                      key={campaign.id}
                      href={`/dashboard/lead-finder/campaigns/${campaign.id}`}
                      className="group flex flex-col gap-3 rounded-lg border border-line p-3 transition-colors hover:border-fg-muted hover:bg-muted"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-fg">
                            {campaign.name}
                          </p>
                          {campaign.target_niche && (
                            <p className="truncate text-xs text-fg-secondary">
                              {campaign.target_niche}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium capitalize ${campaignStatusClass(campaign.status)}`}
                        >
                          {campaign.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-base font-semibold text-fg">
                            {campaign.leadCount ?? 0}
                          </p>
                          <p className="text-xs text-fg-secondary">
                            Leads
                          </p>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-accent-strong">
                            {newCount}
                          </p>
                          <p className="text-xs text-fg-secondary">
                            New
                          </p>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-fg">
                            {campaign.avgScore ?? 0}
                          </p>
                          <p className="text-xs text-fg-secondary">
                            Avg
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-fg-secondary">
                        <span>
                          {campaign.schedule_frequency
                            ? `Runs ${campaign.schedule_frequency}`
                            : "Manual run"}
                        </span>
                        {campaign.updated_at && (
                          <span>{timeAgo(campaign.updated_at)}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {data.totalLeads === 0 && data.totalCampaigns === 0 && (
            <div className="rounded-lg border border-line bg-surface px-4 py-12 text-center">
              <h2 className="text-base font-semibold text-fg mb-2">Get started with Lead Finder</h2>
              <p className="text-sm text-fg-secondary mb-4">Create a campaign to start discovering and enriching leads automatically.</p>
              <Link href="/dashboard/lead-finder/campaigns/new">
                <Button leftIcon={<PlusIcon size={15} />}>Create Campaign</Button>
              </Link>
            </div>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="flex items-center justify-center py-24 text-sm text-fg-secondary">Failed to load analytics.</div>
      )}
    </div>
  );
}
