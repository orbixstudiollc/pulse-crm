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

interface CostData {
  apifyCostByActor: Record<string, { count: number; totalCost: number }>;
  llmCostByOperation: Record<string, { count: number; totalCost: number; inputTokens: number; outputTokens: number }>;
  llmCostByProvider: Record<string, { count: number; totalCost: number }>;
  totalApifyCost: number;
  totalLlmCost: number;
  totalCost: number;
  totalRuns: number;
  totalLlmCalls: number;
  costByCampaign: Record<string, { name: string; apifyCost: number; llmCost: number; totalCost: number; leadCount: number }>;
}

// ── Colors ─────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#818cf8", // indigo
  "#34d399", // emerald
  "#f97316", // orange
  "#f472b6", // pink
  "#60a5fa", // blue
  "#a78bfa", // purple
  "#fbbf24", // amber
  "#2dd4bf", // teal
];

// ── Custom tooltip ─────────────────────────────────────────────────────────

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

// ── Stat card ──────────────────────────────────────────────────────────────

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
      .then((json) => setData(json))
      .catch(() => toast.error("Failed to load cost data"))
      .finally(() => setLoading(false));
  }, []);

  // ── Chart data ─────────────────────────────────────────────────────────

  const campaignBarData = useMemo(() => {
    if (!data?.costByCampaign) return [];
    return Object.values(data.costByCampaign).map((c) => ({
      name: c.name.length > 20 ? c.name.slice(0, 20) + "..." : c.name,
      Apify: c.apifyCost,
      LLM: c.llmCost,
      Total: c.totalCost,
    }));
  }, [data]);

  const operationPieData = useMemo(() => {
    if (!data?.llmCostByOperation) return [];
    return Object.entries(data.llmCostByOperation).map(([name, info]) => ({
      name: name.replace(/_/g, " "),
      value: info.totalCost,
    }));
  }, [data]);

  const avgCostPerLead = useMemo(() => {
    if (!data?.costByCampaign) return 0;
    const campaigns = Object.values(data.costByCampaign);
    const totalLeads = campaigns.reduce((s, c) => s + c.leadCount, 0);
    if (totalLeads === 0) return 0;
    return data.totalCost / totalLeads;
  }, [data]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Finder</h1>
          <p className="text-sm text-[#a0a0a8] mt-1">
            Cost analytics across all campaigns
          </p>
        </div>
      </div>

      {/* Sub nav */}
      <LeadFinderSubNav />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={32} className="animate-spin text-[#a0a0a8]" />
        </div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Cost"
              value={`$${data.totalCost.toFixed(4)}`}
              icon={CurrencyDollarIcon}
              color="text-white"
            />
            <StatCard
              label="Apify Cost"
              value={`$${data.totalApifyCost.toFixed(4)}`}
              icon={LightningIcon}
              color="text-orange-400"
            />
            <StatCard
              label="LLM Cost"
              value={`$${data.totalLlmCost.toFixed(4)}`}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Cost by campaign (bar chart) */}
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <ChartBarIcon size={14} className="text-[#a0a0a8]" />
                Cost by Campaign
              </h3>
              {campaignBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={campaignBarData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#232329"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#a0a0a8", fontSize: 11 }}
                      axisLine={{ stroke: "#232329" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#a0a0a8", fontSize: 11 }}
                      axisLine={{ stroke: "#232329" }}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="Apify"
                      stackId="cost"
                      fill="#f97316"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="LLM"
                      stackId="cost"
                      fill="#a78bfa"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-sm text-[#a0a0a8]">
                  No campaign cost data yet
                </div>
              )}
            </div>

            {/* Cost by operation (pie chart) */}
            <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <SparkleIcon size={14} className="text-[#a0a0a8]" />
                LLM Cost by Operation
              </h3>
              {operationPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={operationPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {operationPieData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `$${Number(value).toFixed(4)}`}
                      contentStyle={{
                        backgroundColor: "#1a1a1f",
                        border: "1px solid #232329",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs text-[#a0a0a8] capitalize">
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-sm text-[#a0a0a8]">
                  No LLM cost data yet
                </div>
              )}
            </div>
          </div>

          {/* Campaign cost breakdown table */}
          <div className="bg-[#141417] border border-[#232329] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#232329]">
              <h3 className="text-sm font-semibold text-white">
                Campaign Cost Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#232329]">
                    <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider text-right">
                      Leads
                    </th>
                    <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider text-right">
                      Apify Cost
                    </th>
                    <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider text-right">
                      LLM Cost
                    </th>
                    <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider text-right">
                      Total Cost
                    </th>
                    <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider text-right">
                      Avg/Lead
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.costByCampaign).length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-sm text-[#a0a0a8]"
                      >
                        No cost data available yet
                      </td>
                    </tr>
                  ) : (
                    Object.entries(data.costByCampaign)
                      .sort(([, a], [, b]) => b.totalCost - a.totalCost)
                      .map(([campaignId, info]) => (
                        <tr
                          key={campaignId}
                          className="border-b border-[#232329]/50 hover:bg-[#1a1a1f] transition-colors"
                        >
                          <td className="p-3">
                            <span className="text-sm text-white font-medium">
                              {info.name}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-sm text-[#a0a0a8]">
                              {info.leadCount}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-sm text-orange-400">
                              ${info.apifyCost.toFixed(4)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-sm text-purple-400">
                              ${info.llmCost.toFixed(4)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-sm text-white font-medium">
                              ${info.totalCost.toFixed(4)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-sm text-[#a0a0a8]">
                              $
                              {info.leadCount > 0
                                ? (info.totalCost / info.leadCount).toFixed(4)
                                : "0.0000"}
                            </span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
                {/* Footer totals */}
                {Object.keys(data.costByCampaign).length > 0 && (
                  <tfoot>
                    <tr className="border-t border-[#232329] bg-[#0a0a0c]">
                      <td className="p-3">
                        <span className="text-sm text-white font-semibold">
                          Total
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm text-white font-medium">
                          {Object.values(data.costByCampaign).reduce(
                            (s, c) => s + c.leadCount,
                            0
                          )}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm text-orange-400 font-medium">
                          ${data.totalApifyCost.toFixed(4)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm text-purple-400 font-medium">
                          ${data.totalLlmCost.toFixed(4)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm text-white font-bold">
                          ${data.totalCost.toFixed(4)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm text-[#a0a0a8] font-medium">
                          ${avgCostPerLead.toFixed(4)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* LLM provider breakdown */}
          {data.llmCostByProvider &&
            Object.keys(data.llmCostByProvider).length > 0 && (
              <div className="mt-6 bg-[#141417] border border-[#232329] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">
                  LLM Provider Breakdown
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(data.llmCostByProvider).map(
                    ([provider, info]) => (
                      <div
                        key={provider}
                        className="p-3 rounded-lg bg-[#0a0a0c] border border-[#232329]"
                      >
                        <p className="text-xs text-[#a0a0a8] mb-1 capitalize">
                          {provider}
                        </p>
                        <p className="text-lg text-white font-semibold">
                          ${info.totalCost.toFixed(4)}
                        </p>
                        <p className="text-[10px] text-[#a0a0a8] mt-1">
                          {info.count} call{info.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
        </>
      )}
    </div>
  );
}
