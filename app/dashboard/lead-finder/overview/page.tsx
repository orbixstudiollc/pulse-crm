"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  UsersIcon,
  TargetIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  PlusIcon,
  LightningIcon,
  ChartBarIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from "@/components/ui";
import { Page, PageHeader, MetricStrip, Section, TableSection, EmptyState, StatCard } from "@/components/dashboard";
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
import { axisTick, chartAccent, chartGrid, chartSeriesExtended, chartTooltipStyle } from "@/lib/design-system/chart-colors";

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
    <Page>
      <PageHeader title="Lead Finder" icon={<MagnifyingGlassIcon size={18} />}>
        <Link href="/dashboard/lead-finder/campaigns/new">
          <Button leftIcon={<PlusIcon size={15} />}>New Campaign</Button>
        </Link>
      </PageHeader>

      <div className="px-8 max-sm:px-4">
        <LeadFinderSubNav />
      </div>

      <div className="px-8 max-sm:px-4 empty:hidden">
        <EnrichmentProgressBanner onBatchFinished={() => void refreshAnalytics()} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-fg-muted" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Metrics */}
          <MetricStrip className="pt-6">
            <StatCard
              label="Total Leads"
              value={data.totalLeads.toLocaleString()}
              icon={<UsersIcon size={20} className="text-fg-secondary" />}
              hint={`${data.activeCampaigns} active campaign${data.activeCampaigns !== 1 ? "s" : ""}`}
            />
            <StatCard
              label="Active Campaigns"
              value={data.activeCampaigns}
              icon={<TargetIcon size={20} className="text-fg-secondary" />}
              hint={`${data.totalCampaigns} total`}
            />
            <StatCard
              label="Conversions"
              value={data.conversions.toLocaleString()}
              icon={<CheckCircleIcon size={20} className="text-fg-secondary" />}
              hint={`${data.conversionRate}% conversion rate`}
            />
            <StatCard
              label="Total Cost"
              value={`$${data.costs.total.toFixed(4)}`}
              icon={<CurrencyDollarIcon size={20} className="text-fg-secondary" />}
              hint={`$${data.costs.avgPerLead.toFixed(4)} avg/lead`}
            />
          </MetricStrip>

          {/* Pipeline Status */}
          <Section title="Pipeline Status">
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
          </Section>

          {/* Charts */}
          <div className="grid grid-cols-1 border-t border-divider lg:grid-cols-2">
            <Section
              title="Score Distribution"
              icon={<ChartBarIcon size={15} />}
              className="border-t-0"
            >
              {scoreChartData.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="range" tick={axisTick} />
                    <YAxis tick={axisTick} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Leads" fill={chartAccent} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-fg-secondary">No scored leads yet</div>
              )}
            </Section>

            <Section
              title="Leads by Source"
              icon={<LightningIcon size={15} />}
              className="border-t border-divider lg:border-t-0 lg:border-l"
            >
              {sourceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sourceChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {sourceChartData.map((_, i) => <Cell key={i} fill={chartSeriesExtended[i % chartSeriesExtended.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number | undefined) => [v ?? 0, "Leads"]} contentStyle={chartTooltipStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-fg-secondary">No leads yet</div>
              )}
            </Section>
          </div>

          {/* Cost breakdown */}
          <Section title="Cost Breakdown" icon={<CurrencyDollarIcon size={15} />}>
            <div className="max-w-[560px] space-y-3">
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
              <div className="pt-2 border-t border-divider flex items-center justify-between text-xs">
                <span className="text-fg-secondary">Total</span>
                <span className="text-fg font-semibold">${data.costs.total.toFixed(4)}</span>
              </div>
              <Link href="/dashboard/lead-finder/costs" className="flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg transition-colors pt-1">
                View full cost report <ArrowRightIcon size={12} />
              </Link>
            </div>
          </Section>

          {/* Recent activity */}
          <div className="border-t border-divider">
            <TableSection title="Recent Activity">
              {data.recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <p className="text-sm text-fg-secondary">No activity yet</p>
                  <Link href="/dashboard/lead-finder/campaigns/new" className="text-xs text-fg underline underline-offset-2">Create your first campaign</Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Activity</th>
                        <th className="text-left">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentActivity.map((event) => (
                        <tr key={event.id}>
                          <td className="text-[14px] text-fg">
                            <div className="flex items-center gap-3">
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${event.type === "discovery_success" ? "bg-success" : event.type === "lead_added" ? "bg-accent-strong" : "bg-fg-muted"}`} />
                              <span className="truncate">{event.description}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap text-[13px] text-fg-secondary">{timeAgo(event.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TableSection>
          </div>

          {/* Per-campaign summary */}
          {campaigns.length > 0 && (
            <div className="border-t border-divider">
              <TableSection
                title="Campaigns"
                actions={
                  <Link
                    href="/dashboard/lead-finder/campaigns"
                    className="flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg transition-colors"
                  >
                    View all <ArrowRightIcon size={12} />
                  </Link>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Campaign</th>
                        <th className="text-left">Status</th>
                        <th className="text-left">Leads</th>
                        <th className="text-left">New</th>
                        <th className="text-left">Avg</th>
                        <th className="text-left">Schedule</th>
                        <th className="text-left">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.slice(0, 6).map((campaign) => {
                        const newCount = Math.max(
                          0,
                          (campaign.leadCount ?? 0) - (campaign.enrichedCount ?? 0)
                        );
                        return (
                          <tr key={campaign.id}>
                            <td>
                              <Link
                                href={`/dashboard/lead-finder/campaigns/${campaign.id}`}
                                className="flex min-w-0 items-center gap-2"
                              >
                                <TargetIcon size={16} className="shrink-0 text-fg-muted" />
                                <span className="min-w-0">
                                  <span className="block truncate text-[14px] font-medium text-fg">
                                    {campaign.name}
                                  </span>
                                  {campaign.target_niche && (
                                    <span className="block truncate text-xs text-fg-secondary">
                                      {campaign.target_niche}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            </td>
                            <td>
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-xs font-medium capitalize ${campaignStatusClass(campaign.status)}`}
                              >
                                {campaign.status}
                              </span>
                            </td>
                            <td className="text-[14px] font-medium text-fg">{campaign.leadCount ?? 0}</td>
                            <td className="text-[14px] font-medium text-accent-strong">{newCount}</td>
                            <td className="text-[14px] font-medium text-fg">{campaign.avgScore ?? 0}</td>
                            <td className="whitespace-nowrap text-[13px] text-fg-secondary">
                              {campaign.schedule_frequency
                                ? `Runs ${campaign.schedule_frequency}`
                                : "Manual run"}
                            </td>
                            <td className="whitespace-nowrap text-[13px] text-fg-secondary">
                              {campaign.updated_at && timeAgo(campaign.updated_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TableSection>
            </div>
          )}

          {data.totalLeads === 0 && data.totalCampaigns === 0 && (
            <EmptyState
              icon={<MagnifyingGlassIcon />}
              title="Get started with Lead Finder"
              description="Create a campaign to start discovering and enriching leads automatically."
              actions={[
                {
                  label: "Create Campaign",
                  href: "/dashboard/lead-finder/campaigns/new",
                  variant: "primary",
                  icon: <PlusIcon size={15} />,
                },
              ]}
            />
          )}
        </>
      )}

      {!loading && !data && (
        <div className="flex items-center justify-center py-24 text-sm text-fg-secondary">Failed to load analytics.</div>
      )}
    </Page>
  );
}
