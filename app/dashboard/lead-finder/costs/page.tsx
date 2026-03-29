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

// ── Colors ─────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#818cf8",
  "#34d399",
  "#f97316",
  "#f472b6",
  "#60a5fa",
  "#a78bfa",
  "#fbbf24",
  "#2dd4bf",
];

const RUN_STATUS: Record<string, { icon: typeof CheckCircleIcon; color: string }> = {
  succeeded: { icon: CheckCircleIcon, color: "text-emerald-400" },
  failed: { icon: XCircleIcon, color: "text-red-400" },
  running: { icon: CircleNotchIcon, color: "text-amber-400" },
  ready: { icon: ClockIcon, color: "text-blue-400" },
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
          {entry.name}: ${entry.value.toFixed(4)}
        </p>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  color?: string;
}) {
  return (
    <div className="bg-[#141417] border border-[#232329] rounded-xl p-4">
      <div className="flex items-center gap-2 text-[#a0a0a8] mb-2">
        <Icon size={14} />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color || "text-white"}`}>{value}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

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
    return Object.values(data.costByCampaign)
      .sort((a, b) => b.totalCost - a.totalCost)
      .map((c) => ({
        name: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name,
        Apify: c.apifyCost,
        LLM: c.llmCost,
      }));
  }, [data]);

  const operationPieData = useMemo(() => {
    if (!data?.llmCostByOperation) return [];
    return Object.entries(data.llmCostByOperation)
      .filter(([, info]) => info.totalCost > 0)
      .map(([name, info]) => ({
        name: name.replace(/-/g, " ").replace(/_/g, " "),
        value: info.totalCost,
      }));
  }, [data]);

  const avgCostPerLead = useMemo(() => {
    if (!data?.costByCampaign) return 0;
    const campaigns = Object.values(data.costByCampaign);
    const totalLeads = campaigns.reduce((s, c) => s + c.leadCount, 0);
    if (totalLeads === 0) return 0;
    return (data.totalCost ?? 0) / totalLeads;
  }, [data]);

  const maxModelCost = useMemo(() => {
    if (!data?.llmCostByModel) return 1;
    return Math.max(...Object.values(data.llmCostByModel).map((m) => m.totalCost), 1);
  }, [data]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Finder</h1>
          <p className="text-sm text-[#a0a0a8] mt-1">Cost analytics across all campaigns</p>
        </div>
      </div>

      <LeadFinderSubNav />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={32} className="animate-spin text-[#a0a0a8]" />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Cost"
              value={`$${(data.totalCost ?? 0).toFixed(4)}`}
              icon={CurrencyDollarIcon}
            />
            <StatCard
              label="Apify Cost"
              value={`$${(data.totalApifyCost ?? 0).toFixed(4)}`}
              icon={LightningIcon}
              color="text-orange-400"
            />
            <StatCard
              label="LLM Cost"
              value={`$${(data.totalLlmCost ?? 0).toFixed(4)}`}
              icon={SparkleIcon}
              color="text-purple-400"
            />
            <StatCard
              label="Avg Cost/Lead"
              value={`$${avgCostPerLead.toFixed(4)}`}
              icon={UsersIcon}
              color="text-emerald-400"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by campaign */}
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <ChartBarIcon size={14} className="text-[#a0a0a8]" />
                Cost by Campaign
              </h3>
              {campaignBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={campaignBarData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232329" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#a0a0a8", fontSize: 11 }} axisLine={{ stroke: "#232329" }} tickLine={false} />
                    <YAxis tick={{ fill: "#a0a0a8", fontSize: 11 }} axisLine={{ stroke: "#232329" }} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Apify" stackId="cost" fill="#f97316" />
                    <Bar dataKey="LLM" stackId="cost" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-[#a0a0a8]">
                  No campaign cost data yet
                </div>
              )}
            </div>

            {/* LLM by operation (pie) */}
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <SparkleIcon size={14} className="text-[#a0a0a8]" />
                LLM Cost by Operation
              </h3>
              {operationPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={operationPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {operationPieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, "Cost"]}
                      contentStyle={{ background: "#1a1a1f", border: "1px solid #232329", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#a0a0a8" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-[#a0a0a8]">
                  No LLM cost data yet
                </div>
              )}
            </div>
          </div>

          {/* Per-model token breakdown */}
          {data.llmCostByModel && Object.keys(data.llmCostByModel).length > 0 && (
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">LLM Model Breakdown</h3>
              <div className="space-y-4">
                {Object.entries(data.llmCostByModel)
                  .sort(([, a], [, b]) => b.totalCost - a.totalCost)
                  .map(([model, info]) => {
                    const pct = Math.round((info.totalCost / maxModelCost) * 100);
                    return (
                      <div key={model}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{model}</span>
                            <span className="text-[#a0a0a8] px-1.5 py-0.5 rounded bg-[#232329] capitalize">
                              {info.provider}
                            </span>
                          </div>
                          <span className="text-white font-medium">${info.totalCost.toFixed(4)}</span>
                        </div>
                        <div className="h-1.5 bg-[#232329] rounded-full overflow-hidden mb-1.5">
                          <div
                            className="h-full bg-purple-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-[#a0a0a8]">
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
          <div className="bg-[#141417] border border-[#232329] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#232329]">
              <h3 className="text-sm font-semibold text-white">Campaign Cost Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#232329]">
                    {["Campaign", "Leads", "Apify Cost", "LLM Cost", "Total Cost", "Avg/Lead"].map((h, i) => (
                      <th
                        key={h}
                        className={`p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider ${i > 0 ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.costByCampaign).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-[#a0a0a8]">
                        No cost data yet
                      </td>
                    </tr>
                  ) : (
                    Object.entries(data.costByCampaign)
                      .sort(([, a], [, b]) => b.totalCost - a.totalCost)
                      .map(([id, info]) => (
                        <tr key={id} className="border-b border-[#232329]/50 hover:bg-[#1a1a1f] transition-colors">
                          <td className="p-3 text-sm text-white font-medium">{info.name}</td>
                          <td className="p-3 text-right text-sm text-[#a0a0a8]">{info.leadCount}</td>
                          <td className="p-3 text-right text-sm text-orange-400">${info.apifyCost.toFixed(4)}</td>
                          <td className="p-3 text-right text-sm text-purple-400">${info.llmCost.toFixed(4)}</td>
                          <td className="p-3 text-right text-sm text-white font-medium">${info.totalCost.toFixed(4)}</td>
                          <td className="p-3 text-right text-sm text-[#a0a0a8]">
                            ${info.leadCount > 0 ? (info.totalCost / info.leadCount).toFixed(4) : "0.0000"}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
                {Object.keys(data.costByCampaign).length > 0 && (
                  <tfoot>
                    <tr className="border-t border-[#232329] bg-[#0a0a0c]">
                      <td className="p-3 text-sm text-white font-semibold">Total</td>
                      <td className="p-3 text-right text-sm text-white font-medium">
                        {Object.values(data.costByCampaign).reduce((s, c) => s + c.leadCount, 0)}
                      </td>
                      <td className="p-3 text-right text-sm text-orange-400 font-medium">${data.totalApifyCost.toFixed(4)}</td>
                      <td className="p-3 text-right text-sm text-purple-400 font-medium">${data.totalLlmCost.toFixed(4)}</td>
                      <td className="p-3 text-right text-sm text-white font-bold">${data.totalCost.toFixed(4)}</td>
                      <td className="p-3 text-right text-sm text-[#a0a0a8] font-medium">${avgCostPerLead.toFixed(4)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* LLM cost by operation table */}
          {Object.keys(data.llmCostByOperation).length > 0 && (
            <div className="bg-[#141417] border border-[#232329] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#232329]">
                <h3 className="text-sm font-semibold text-white">LLM Cost by Operation</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#232329]">
                      {["Operation", "Calls", "Input Tokens", "Output Tokens", "Cost"].map((h, i) => (
                        <th key={h} className={`p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider ${i > 0 ? "text-right" : ""}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.llmCostByOperation)
                      .sort(([, a], [, b]) => b.totalCost - a.totalCost)
                      .map(([op, info]) => (
                        <tr key={op} className="border-b border-[#232329]/50 hover:bg-[#1a1a1f] transition-colors">
                          <td className="p-3 text-sm text-white capitalize">{op.replace(/-/g, " ")}</td>
                          <td className="p-3 text-right text-sm text-[#a0a0a8]">{info.count}</td>
                          <td className="p-3 text-right text-sm text-[#a0a0a8]">{info.inputTokens.toLocaleString()}</td>
                          <td className="p-3 text-right text-sm text-[#a0a0a8]">{info.outputTokens.toLocaleString()}</td>
                          <td className="p-3 text-right text-sm text-purple-400 font-medium">${info.totalCost.toFixed(4)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Apify runs */}
          <div className="bg-[#141417] border border-[#232329] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#232329]">
              <h3 className="text-sm font-semibold text-white">Recent Apify Runs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#232329]">
                    {["Actor", "Campaign", "Status", "Results", "Cost", "When"].map((h, i) => (
                      <th key={h} className={`p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider ${i >= 3 ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!data.recentRuns || data.recentRuns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-[#a0a0a8]">
                        No Apify runs yet
                      </td>
                    </tr>
                  ) : (
                    data.recentRuns.map((run) => {
                      const statusInfo = RUN_STATUS[run.status] ?? RUN_STATUS["ready"];
                      const StatusIcon = statusInfo.icon;
                      return (
                        <tr key={run.id} className="border-b border-[#232329]/50 hover:bg-[#1a1a1f] transition-colors">
                          <td className="p-3">
                            <span className="text-sm text-white font-mono text-xs">{run.actorId}</span>
                          </td>
                          <td className="p-3 text-sm text-[#a0a0a8]">{run.campaignName}</td>
                          <td className="p-3">
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon size={12} weight="fill" />
                              {run.status}
                            </span>
                          </td>
                          <td className="p-3 text-right text-sm text-[#a0a0a8]">{run.resultCount}</td>
                          <td className="p-3 text-right text-sm text-orange-400">${run.costUsd.toFixed(4)}</td>
                          <td className="p-3 text-right text-sm text-[#a0a0a8]">{timeAgo(run.startedAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
