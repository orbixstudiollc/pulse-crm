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
} from "@/components/ui";
import { PageHeader, StatCard } from "@/components/dashboard";
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

const CHART_COLORS = ["#818cf8", "#34d399", "#f97316", "#f472b6", "#60a5fa", "#a78bfa", "#fbbf24", "#2dd4bf"];

const RUN_STATUS: Record<string, { icon: typeof CheckCircleIcon; color: string }> = {
  succeeded: { icon: CheckCircleIcon, color: "text-green-600 dark:text-green-400" },
  failed: { icon: XCircleIcon, color: "text-red-600 dark:text-red-400" },
  running: { icon: CircleNotchIcon, color: "text-amber-600 dark:text-amber-400" },
  ready: { icon: ClockIcon, color: "text-blue-600 dark:text-blue-400" },
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
        <p key={i} className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">${e.value.toFixed(4)} <span className="font-normal text-neutral-500">{e.name}</span></p>
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
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader title="Lead Finder" />
      <LeadFinderSubNav />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-neutral-400" />
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Cost" value={`$${(data.totalCost ?? 0).toFixed(4)}`} icon={<CurrencyDollarIcon size={20} className="text-neutral-500 dark:text-neutral-400" />} />
            <StatCard label="Apify Cost" value={`$${(data.totalApifyCost ?? 0).toFixed(4)}`} icon={<LightningIcon size={20} className="text-neutral-500 dark:text-neutral-400" />} />
            <StatCard label="LLM Cost" value={`$${(data.totalLlmCost ?? 0).toFixed(4)}`} icon={<SparkleIcon size={20} className="text-neutral-500 dark:text-neutral-400" />} />
            <StatCard label="Avg Cost / Lead" value={`$${avgCostPerLead.toFixed(4)}`} icon={<UsersIcon size={20} className="text-neutral-500 dark:text-neutral-400" />} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ChartBarIcon size={14} className="text-neutral-400 dark:text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Cost by Campaign</h3>
              </div>
              {campaignBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={campaignBarData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="text-neutral-200 dark:text-neutral-800" stroke="currentColor" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "currentColor", fontSize: 11 }} className="text-neutral-500 dark:text-neutral-400" tickLine={false} />
                    <YAxis tick={{ fill: "currentColor", fontSize: 11 }} className="text-neutral-500 dark:text-neutral-400" tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Apify" stackId="cost" fill="#f97316" />
                    <Bar dataKey="LLM" stackId="cost" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-neutral-400 dark:text-neutral-500">No campaign cost data yet</div>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <SparkleIcon size={14} className="text-neutral-400 dark:text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">LLM Cost by Operation</h3>
              </div>
              {operationPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={operationPieData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                      {operationPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, "Cost"]} contentStyle={{ background: "var(--color-bg)", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-neutral-400 dark:text-neutral-500">No LLM cost data yet</div>
              )}
            </div>
          </div>

          {/* Per-model token breakdown */}
          {data.llmCostByModel && Object.keys(data.llmCostByModel).length > 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4">LLM Model Breakdown</h3>
              <div className="space-y-4">
                {Object.entries(data.llmCostByModel).sort(([, a], [, b]) => b.totalCost - a.totalCost).map(([model, info]) => {
                  const pct = Math.round((info.totalCost / maxModelCost) * 100);
                  return (
                    <div key={model}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-950 dark:text-neutral-50 font-medium">{model}</span>
                          <span className="text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 capitalize text-[11px]">{info.provider}</span>
                        </div>
                        <span className="text-neutral-950 dark:text-neutral-50 font-medium">${info.totalCost.toFixed(4)}</span>
                      </div>
                      <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span>{info.inputTokens.toLocaleString()} input tokens</span>
                        <span>{info.outputTokens.toLocaleString()} output tokens</span>
                        <span>{info.count} call{info.count !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campaign cost table */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Campaign Cost Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    {["Campaign", "Leads", "Apify Cost", "LLM Cost", "Total Cost", "Avg/Lead"].map((h, i) => (
                      <th key={h} className={`py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400 ${i > 0 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.costByCampaign).length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">No cost data yet</td></tr>
                  ) : (
                    Object.entries(data.costByCampaign).sort(([, a], [, b]) => b.totalCost - a.totalCost).map(([id, info]) => (
                      <tr key={id} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-neutral-950 dark:text-neutral-50">{info.name}</td>
                        <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">{info.leadCount}</td>
                        <td className="py-3 px-4 text-right text-orange-600 dark:text-orange-400">${info.apifyCost.toFixed(4)}</td>
                        <td className="py-3 px-4 text-right text-violet-600 dark:text-violet-400">${info.llmCost.toFixed(4)}</td>
                        <td className="py-3 px-4 text-right font-medium text-neutral-950 dark:text-neutral-50">${info.totalCost.toFixed(4)}</td>
                        <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">${info.leadCount > 0 ? (info.totalCost / info.leadCount).toFixed(4) : "0.0000"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {Object.keys(data.costByCampaign).length > 0 && (
                  <tfoot>
                    <tr className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                      <td className="py-3 px-4 font-semibold text-neutral-950 dark:text-neutral-50">Total</td>
                      <td className="py-3 px-4 text-right font-medium text-neutral-950 dark:text-neutral-50">{Object.values(data.costByCampaign).reduce((s, c) => s + c.leadCount, 0)}</td>
                      <td className="py-3 px-4 text-right font-medium text-orange-600 dark:text-orange-400">${data.totalApifyCost.toFixed(4)}</td>
                      <td className="py-3 px-4 text-right font-medium text-violet-600 dark:text-violet-400">${data.totalLlmCost.toFixed(4)}</td>
                      <td className="py-3 px-4 text-right font-bold text-neutral-950 dark:text-neutral-50">${data.totalCost.toFixed(4)}</td>
                      <td className="py-3 px-4 text-right font-medium text-neutral-600 dark:text-neutral-400">${avgCostPerLead.toFixed(4)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* LLM by operation table */}
          {Object.keys(data.llmCostByOperation).length > 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">LLM Cost by Operation</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800">
                      {["Operation", "Calls", "Input Tokens", "Output Tokens", "Cost"].map((h, i) => (
                        <th key={h} className={`py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400 ${i > 0 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.llmCostByOperation).sort(([, a], [, b]) => b.totalCost - a.totalCost).map(([op, info]) => (
                      <tr key={op} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="py-3 px-4 text-neutral-950 dark:text-neutral-50 capitalize">{op.replace(/-/g, " ")}</td>
                        <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">{info.count}</td>
                        <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">{info.inputTokens.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">{info.outputTokens.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-medium text-violet-600 dark:text-violet-400">${info.totalCost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Apify Runs */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Recent Apify Runs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    {["Actor", "Campaign", "Status", "Results", "Cost", "When"].map((h, i) => (
                      <th key={h} className={`py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400 ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!data.recentRuns || data.recentRuns.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">No Apify runs yet</td></tr>
                  ) : (
                    data.recentRuns.map((run) => {
                      const statusInfo = RUN_STATUS[run.status] ?? RUN_STATUS["ready"];
                      const StatusIcon = statusInfo.icon;
                      return (
                        <tr key={run.id} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs text-neutral-950 dark:text-neutral-50">{run.actorId}</td>
                          <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">{run.campaignName}</td>
                          <td className="py-3 px-4">
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon size={12} weight="fill" />{run.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">{run.resultCount}</td>
                          <td className="py-3 px-4 text-right text-orange-600 dark:text-orange-400">${run.costUsd.toFixed(4)}</td>
                          <td className="py-3 px-4 text-right text-neutral-500 dark:text-neutral-400">{timeAgo(run.startedAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
