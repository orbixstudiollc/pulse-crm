"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  CurrencyDollarIcon,
  LightningIcon,
  SparkleIcon,
  UsersIcon,
  CircleNotchIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  TargetIcon,
} from "@/components/ui";
import { Page, PageHeader, MetricStrip, Section, TableSection, StatCard } from "@/components/dashboard";
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
import { axisTick, chartAccent, chartGrid, chartSeriesExtended, chartTooltipStyle, chartWarning } from "@/lib/design-system/chart-colors";

// ── Types ──────────────────────────────────────────────────────────────────

interface RecentRun {
  id: string;
  actorId: string;
  status: string;
  resultCount: number;
  costUsd: number;
  startedAt: string;
  campaignName: string;
}

interface LlmModelInfo {
  provider: string;
  count: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
}

interface CostData {
  apifyCostByActor: Record<string, { count: number; totalCost: number }>;
  llmCostByOperation: Record<string, { count: number; totalCost: number; inputTokens: number; outputTokens: number }>;
  llmCostByModel: Record<string, LlmModelInfo>;
  llmCostByProvider: Record<string, { count: number; totalCost: number }>;
  totalApifyCost: number;
  totalLlmCost: number;
  totalCost: number;
  totalRuns: number;
  totalLlmCalls: number;
  costByCampaign: Record<string, { name: string; apifyCost: number; llmCost: number; totalCost: number; leadCount: number }>;
  recentRuns: RecentRun[];
}

const RUN_STATUS: Record<string, { icon: typeof CheckCircleIcon; color: string }> = {
  succeeded: { icon: CheckCircleIcon, color: "text-success" },
  failed: { icon: XCircleIcon, color: "text-danger" },
  running: { icon: CircleNotchIcon, color: "text-warning" },
  ready: { icon: ClockIcon, color: "text-accent-strong" },
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
        <p key={i} className="text-sm font-semibold text-fg">${e.value.toFixed(4)} <span className="font-normal text-fg-secondary">{e.name}</span></p>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lead-finder/costs")
      .then((res) => res.json())
      .then((json) => setData(json.data ?? null))
      .catch(() => toast.error("Failed to load cost data"))
      .finally(() => setLoading(false));
  }, []);

  const campaignBarData = useMemo(() => {
    if (!data?.costByCampaign) return [];
    return Object.values(data.costByCampaign).sort((a, b) => b.totalCost - a.totalCost).map((c) => ({
      name: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name,
      Apify: c.apifyCost,
      LLM: c.llmCost,
    }));
  }, [data]);

  const operationPieData = useMemo(() => {
    if (!data?.llmCostByOperation) return [];
    return Object.entries(data.llmCostByOperation).filter(([, info]) => info.totalCost > 0).map(([name, info]) => ({
      name: name.replace(/-/g, " ").replace(/_/g, " "),
      value: info.totalCost,
    }));
  }, [data]);

  const avgCostPerLead = useMemo(() => {
    if (!data?.costByCampaign) return 0;
    const totalLeads = Object.values(data.costByCampaign).reduce((s, c) => s + c.leadCount, 0);
    if (totalLeads === 0) return 0;
    return (data.totalCost ?? 0) / totalLeads;
  }, [data]);

  const maxModelCost = useMemo(() => {
    if (!data?.llmCostByModel) return 1;
    return Math.max(...Object.values(data.llmCostByModel).map((m) => m.totalCost), 1);
  }, [data]);

  return (
    <Page>
      <PageHeader title="Lead Finder" icon={<MagnifyingGlassIcon size={18} />} />
      <div className="px-8 max-sm:px-4">
        <LeadFinderSubNav />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-fg-muted" />
        </div>
      )}

      {data && (
        <>
          {/* KPI Metrics */}
          <MetricStrip className="pt-6">
            <StatCard label="Total Cost" value={`$${(data.totalCost ?? 0).toFixed(4)}`} icon={<CurrencyDollarIcon size={20} className="text-fg-secondary" />} />
            <StatCard label="Apify Cost" value={`$${(data.totalApifyCost ?? 0).toFixed(4)}`} icon={<LightningIcon size={20} className="text-fg-secondary" />} />
            <StatCard label="LLM Cost" value={`$${(data.totalLlmCost ?? 0).toFixed(4)}`} icon={<SparkleIcon size={20} className="text-fg-secondary" />} />
            <StatCard label="Avg Cost / Lead" value={`$${avgCostPerLead.toFixed(4)}`} icon={<UsersIcon size={20} className="text-fg-secondary" />} />
          </MetricStrip>

          {/* Charts */}
          <div className="grid grid-cols-1 border-t border-divider lg:grid-cols-2">
            <Section
              title="Cost by Campaign"
              icon={<ChartBarIcon size={14} />}
              className="border-t-0"
            >
              {campaignBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={campaignBarData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} />
                    <YAxis tick={axisTick} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Apify" stackId="cost" fill={chartWarning} />
                    <Bar dataKey="LLM" stackId="cost" fill={chartAccent} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-fg-secondary">No campaign cost data yet</div>
              )}
            </Section>

            <Section
              title="LLM Cost by Operation"
              icon={<SparkleIcon size={14} />}
              className="border-t border-divider lg:border-t-0 lg:border-l"
            >
              {operationPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={operationPieData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                      {operationPieData.map((_, i) => <Cell key={i} fill={chartSeriesExtended[i % chartSeriesExtended.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, "Cost"]} contentStyle={chartTooltipStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-fg-secondary">No LLM cost data yet</div>
              )}
            </Section>
          </div>

          {/* Per-model token breakdown */}
          {data.llmCostByModel && Object.keys(data.llmCostByModel).length > 0 && (
            <Section title="LLM Model Breakdown">
              <div className="max-w-[560px] space-y-4">
                {Object.entries(data.llmCostByModel).sort(([, a], [, b]) => b.totalCost - a.totalCost).map(([model, info]) => {
                  const pct = Math.round((info.totalCost / maxModelCost) * 100);
                  return (
                    <div key={model}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-fg font-medium">{model}</span>
                          <span className="text-fg-secondary px-1.5 py-0.5 rounded bg-muted capitalize text-xs">{info.provider}</span>
                        </div>
                        <span className="text-fg font-medium">${info.totalCost.toFixed(4)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-accent-strong rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-fg-secondary">
                        <span>{info.inputTokens.toLocaleString()} input tokens</span>
                        <span>{info.outputTokens.toLocaleString()} output tokens</span>
                        <span>{info.count} call{info.count !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Campaign cost table */}
          <div className="border-t border-divider">
            <TableSection title="Campaign Cost Breakdown">
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr>
                      {["Campaign", "Leads", "Apify Cost", "LLM Cost", "Total Cost", "Avg/Lead"].map((h, i) => (
                        <th key={h} className={`text-[13px] font-medium text-fg-secondary ${i > 0 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.costByCampaign).length === 0 ? (
                      <tr><td colSpan={6} className="py-10 text-center text-sm text-fg-secondary">No cost data yet</td></tr>
                    ) : (
                      Object.entries(data.costByCampaign).sort(([, a], [, b]) => b.totalCost - a.totalCost).map(([id, info]) => (
                        <tr key={id} className="transition-colors">
                          <td className="py-2 font-medium text-fg">
                            <div className="flex items-center gap-2">
                              <TargetIcon size={16} className="shrink-0 text-fg-muted" />
                              {info.name}
                            </div>
                          </td>
                          <td className="py-2 text-right text-fg-secondary">{info.leadCount}</td>
                          <td className="py-2 text-right text-warning">${info.apifyCost.toFixed(4)}</td>
                          <td className="py-2 text-right text-accent-strong">${info.llmCost.toFixed(4)}</td>
                          <td className="py-2 text-right font-medium text-fg">${info.totalCost.toFixed(4)}</td>
                          <td className="py-2 text-right text-fg-secondary">${info.leadCount > 0 ? (info.totalCost / info.leadCount).toFixed(4) : "0.0000"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {Object.keys(data.costByCampaign).length > 0 && (
                    <tfoot>
                      <tr>
                        <td className="py-2 font-semibold text-fg">Total</td>
                        <td className="py-2 text-right font-medium text-fg">{Object.values(data.costByCampaign).reduce((s, c) => s + c.leadCount, 0)}</td>
                        <td className="py-2 text-right font-medium text-warning">${data.totalApifyCost.toFixed(4)}</td>
                        <td className="py-2 text-right font-medium text-accent-strong">${data.totalLlmCost.toFixed(4)}</td>
                        <td className="py-2 text-right font-semibold text-fg">${data.totalCost.toFixed(4)}</td>
                        <td className="py-2 text-right font-medium text-fg-secondary">${avgCostPerLead.toFixed(4)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </TableSection>
          </div>

          {/* LLM by operation table */}
          {Object.keys(data.llmCostByOperation).length > 0 && (
            <div className="border-t border-divider">
              <TableSection title="LLM Cost by Operation">
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr>
                        {["Operation", "Calls", "Input Tokens", "Output Tokens", "Cost"].map((h, i) => (
                          <th key={h} className={`text-[13px] font-medium text-fg-secondary ${i > 0 ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.llmCostByOperation).sort(([, a], [, b]) => b.totalCost - a.totalCost).map(([op, info]) => (
                        <tr key={op} className="transition-colors">
                          <td className="py-2 text-fg capitalize">
                            <div className="flex items-center gap-2">
                              <SparkleIcon size={16} className="shrink-0 text-fg-muted" />
                              {op.replace(/-/g, " ")}
                            </div>
                          </td>
                          <td className="py-2 text-right text-fg-secondary">{info.count}</td>
                          <td className="py-2 text-right text-fg-secondary">{info.inputTokens.toLocaleString()}</td>
                          <td className="py-2 text-right text-fg-secondary">{info.outputTokens.toLocaleString()}</td>
                          <td className="py-2 text-right font-medium text-accent-strong">${info.totalCost.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableSection>
            </div>
          )}

          {/* Recent Apify Runs */}
          <div className="border-t border-divider">
            <TableSection title="Recent Apify Runs">
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr>
                      {["Actor", "Campaign", "Status", "Results", "Cost", "When"].map((h, i) => (
                        <th key={h} className={`text-[13px] font-medium text-fg-secondary ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!data.recentRuns || data.recentRuns.length === 0 ? (
                      <tr><td colSpan={6} className="py-10 text-center text-sm text-fg-secondary">No Apify runs yet</td></tr>
                    ) : (
                      data.recentRuns.map((run) => {
                        const statusInfo = RUN_STATUS[run.status] ?? RUN_STATUS["ready"];
                        const StatusIcon = statusInfo.icon;
                        return (
                          <tr key={run.id} className="transition-colors">
                            <td className="py-2 font-mono text-xs text-fg">
                              <div className="flex items-center gap-2">
                                <LightningIcon size={16} className="shrink-0 text-fg-muted" />
                                {run.actorId}
                              </div>
                            </td>
                            <td className="py-2 text-fg-secondary">{run.campaignName}</td>
                            <td className="py-2">
                              <span className={`flex items-center gap-1.5 text-xs font-medium ${statusInfo.color}`}>
                                <StatusIcon size={12} weight="fill" />{run.status}
                              </span>
                            </td>
                            <td className="py-2 text-right text-fg-secondary">{run.resultCount}</td>
                            <td className="py-2 text-right text-warning">${run.costUsd.toFixed(4)}</td>
                            <td className="py-2 text-right text-fg-secondary">{timeAgo(run.startedAt)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </TableSection>
          </div>
        </>
      )}
    </Page>
  );
}
