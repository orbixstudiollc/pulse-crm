"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  Button,
  FunnelIcon,
  CurrencyDollarIcon,
  TrophyIcon,
  ActivityIcon,
  PulseIcon,
  CrosshairIcon,
  GlobeIcon,
  SparkleIcon,
  EnvelopeIcon,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { aiGenerateInsightsSummary, aiAnalyzePipeline, aiIdentifyRisks, aiPredictForecast } from "@/lib/actions/ai-analytics";
import type { EmailOverviewStats, AccountHealth, DailyEmailVolume } from "@/lib/actions/email-analytics";

// ── Types ────────────────────────────────────────────────────────────────────

interface PipelineData {
  stages: { stage: string; count: number; totalValue: number }[];
  totalDeals: number;
  avgDealValue: number;
}

interface SourceData {
  source: string;
  count: number;
  avgScore: number;
  hotRate: number;
}

interface ForecastData {
  weighted: number;
  deals: {
    stage: string;
    value: number;
    probability: number;
    weightedValue: number;
    expectedClose: string | null;
  }[];
}

interface WinLossData {
  won: number;
  lost: number;
  winRate: number;
  avgWonValue: number;
  avgLostValue: number;
}

interface ActivityData {
  total: number;
  byType: Record<string, number>;
}

interface FunnelData {
  leads: number;
  deals: number;
  customers: number;
  leadToDealRate: number;
  dealToCustomerRate: number;
}

interface SequenceData {
  id: string;
  name: string;
  status: string;
  total_enrolled: number;
  reply_rate: number;
}

interface ICPData {
  profileId: string;
  name: string;
  color: string | null;
  matchedLeads: number;
  hotLeads: number;
  avgMatchScore: number;
}

interface EmailAnalyticsData {
  overview: EmailOverviewStats;
  accounts: AccountHealth[];
  dailyVolume: DailyEmailVolume[];
}

interface AnalyticsPageClientProps {
  pipeline: PipelineData;
  sources: SourceData[];
  forecast: ForecastData;
  winLoss: WinLossData;
  activities: ActivityData;
  funnel: FunnelData;
  sequences: SequenceData[];
  icp: ICPData[];
  email?: EmailAnalyticsData;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "pipeline", label: "Pipeline", icon: FunnelIcon },
  { id: "sources", label: "Sources", icon: GlobeIcon },
  { id: "forecast", label: "Forecast", icon: CurrencyDollarIcon },
  { id: "winloss", label: "Win/Loss", icon: TrophyIcon },
  { id: "activity", label: "Activity", icon: ActivityIcon },
  { id: "sequences", label: "Sequences", icon: PulseIcon },
  { id: "icp", label: "ICP", icon: CrosshairIcon },
  { id: "email", label: "Email", icon: EnvelopeIcon },
  { id: "ai-insights", label: "AI Insights", icon: SparkleIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CHART_COLORS = {
  indigo: "#6366f1",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#8b5cf6",
};

const STAGE_COLORS: Record<string, string> = {
  discovery: CHART_COLORS.indigo,
  proposal: CHART_COLORS.amber,
  negotiation: CHART_COLORS.purple,
  closed_won: CHART_COLORS.green,
  closed_lost: CHART_COLORS.red,
};

function formatStageName(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Shared Components ────────────────────────────────────────────────────────

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StatBox({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <Card>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-serif font-semibold text-neutral-950 dark:text-neutral-50">
        {value}
      </p>
      {subValue && (
        <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">
          {subValue}
        </p>
      )}
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="flex items-center justify-center py-16">
      <p className="text-sm text-neutral-400 dark:text-neutral-500">
        {message}
      </p>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mb-4">
      {children}
    </h3>
  );
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter || ((v: number) => v.toLocaleString());

  return (
    <div className="rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
        {label}
      </p>
      {payload.map((entry, i) => (
        <p
          key={i}
          className="text-sm font-semibold text-neutral-950 dark:text-neutral-50"
        >
          {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── Tab Content Components ───────────────────────────────────────────────────

function PipelineTab({ data }: { data: PipelineData }) {
  if (data.stages.length === 0) {
    return <EmptyState message="No pipeline data available" />;
  }

  const chartData = data.stages.map((s) => ({
    ...s,
    name: formatStageName(s.stage),
    fill: STAGE_COLORS[s.stage] || CHART_COLORS.indigo,
  }));

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatBox label="Total Deals" value={String(data.totalDeals)} />
        <StatBox
          label="Avg Deal Value"
          value={formatCurrency(data.avgDealValue)}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal count per stage */}
        <Card>
          <SectionTitle>Deals by Stage</SectionTitle>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-neutral-200 dark:text-neutral-800"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Total value per stage */}
        <Card>
          <SectionTitle>Value by Stage</SectionTitle>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-neutral-200 dark:text-neutral-800"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v) => formatCurrency(v)}
                    />
                  }
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="totalValue" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SourcesTab({ data }: { data: SourceData[] }) {
  if (data.length === 0) {
    return <EmptyState message="No lead source data available" />;
  }

  const chartData = data.map((s, i) => ({
    ...s,
    name: s.source,
    fill: Object.values(CHART_COLORS)[i % Object.values(CHART_COLORS).length],
  }));

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead count by source */}
        <Card>
          <SectionTitle>Leads by Source</SectionTitle>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-neutral-200 dark:text-neutral-800"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Avg score by source */}
        <Card>
          <SectionTitle>Avg Score by Source</SectionTitle>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-neutral-200 dark:text-neutral-800"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <SectionTitle>Source Details</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                  Source
                </th>
                <th className="text-right py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                  Leads
                </th>
                <th className="text-right py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                  Avg Score
                </th>
                <th className="text-right py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                  Hot Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((source) => (
                <tr
                  key={source.source}
                  className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0"
                >
                  <td className="py-3 px-4 font-medium text-neutral-950 dark:text-neutral-50">
                    {source.source}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">
                    {source.count}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">
                    {source.avgScore}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        source.hotRate >= 50
                          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : source.hotRate >= 25
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
                      )}
                    >
                      {source.hotRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ForecastTab({ data }: { data: ForecastData }) {
  if (data.deals.length === 0) {
    return <EmptyState message="No forecast data available" />;
  }

  return (
    <div className="space-y-6">
      {/* Big number */}
      <Card className="text-center py-10">
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
          Weighted Pipeline Value
        </p>
        <p className="text-4xl font-serif font-bold text-neutral-950 dark:text-neutral-50">
          {formatCurrency(data.weighted)}
        </p>
      </Card>

      {/* Deals table */}
      <Card>
        <SectionTitle>Forecast Deals</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                  Stage
                </th>
                <th className="text-right py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                  Value
                </th>
                <th className="text-right py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                  Probability
                </th>
                <th className="text-right py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                  Weighted
                </th>
                <th className="text-right py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                  Expected Close
                </th>
              </tr>
            </thead>
            <tbody>
              {data.deals.map((deal, i) => (
                <tr
                  key={i}
                  className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0"
                >
                  <td className="py-3 px-4">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor:
                          (STAGE_COLORS[deal.stage] || CHART_COLORS.indigo) +
                          "1a",
                        color:
                          STAGE_COLORS[deal.stage] || CHART_COLORS.indigo,
                      }}
                    >
                      {formatStageName(deal.stage)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-neutral-950 dark:text-neutral-50">
                    {formatCurrency(deal.value)}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">
                    {deal.probability}%
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-neutral-950 dark:text-neutral-50">
                    {formatCurrency(deal.weightedValue)}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">
                    {deal.expectedClose
                      ? new Date(deal.expectedClose).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )
                      : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function WinLossTab({ data }: { data: WinLossData }) {
  const totalDeals = data.won + data.lost;

  if (totalDeals === 0) {
    return <EmptyState message="No win/loss data available" />;
  }

  const wonPercent = totalDeals > 0 ? (data.won / totalDeals) * 100 : 0;
  const lostPercent = totalDeals > 0 ? (data.lost / totalDeals) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatBox label="Won" value={String(data.won)} />
        <StatBox label="Lost" value={String(data.lost)} />
        <StatBox label="Win Rate" value={`${data.winRate}%`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatBox
          label="Avg Won Value"
          value={formatCurrency(data.avgWonValue)}
        />
        <StatBox
          label="Avg Lost Value"
          value={formatCurrency(data.avgLostValue)}
        />
      </div>

      {/* Visual comparison */}
      <Card>
        <SectionTitle>Win vs Loss Distribution</SectionTitle>
        <div className="space-y-4">
          {/* Won bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-950 dark:text-neutral-50">
                Won
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                {data.won} deals ({wonPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="h-4 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${wonPercent}%`,
                  backgroundColor: CHART_COLORS.green,
                }}
              />
            </div>
          </div>

          {/* Lost bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-950 dark:text-neutral-50">
                Lost
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                {data.lost} deals ({lostPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="h-4 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${lostPercent}%`,
                  backgroundColor: CHART_COLORS.red,
                }}
              />
            </div>
          </div>
        </div>

        {/* Value comparison */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
            <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
              Avg Won Deal
            </p>
            <p className="text-xl font-serif font-semibold text-green-700 dark:text-green-300">
              {formatCurrency(data.avgWonValue)}
            </p>
          </div>
          <div className="rounded p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
              Avg Lost Deal
            </p>
            <p className="text-xl font-serif font-semibold text-red-700 dark:text-red-300">
              {formatCurrency(data.avgLostValue)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ActivityTab({ data }: { data: ActivityData }) {
  if (data.total === 0) {
    return <EmptyState message="No activity data available" />;
  }

  const chartData = Object.entries(data.byType).map(([type, count], i) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    count,
    fill: Object.values(CHART_COLORS)[i % Object.values(CHART_COLORS).length],
  }));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <StatBox
        label="Total Activities (Last 30 Days)"
        value={String(data.total)}
        subValue={`${Object.keys(data.byType).length} activity types`}
      />

      {/* Chart */}
      <Card>
        <SectionTitle>Activities by Type</SectionTitle>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-neutral-200 dark:text-neutral-800"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="text-neutral-500 dark:text-neutral-400"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                className="text-neutral-500 dark:text-neutral-400"
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "transparent" }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function SequencesTab({ data }: { data: SequenceData[] }) {
  if (data.length === 0) {
    return <EmptyState message="No sequence data available" />;
  }

  return (
    <Card>
      <SectionTitle>Sequence Performance</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                Sequence
              </th>
              <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                Status
              </th>
              <th className="text-right py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                Enrolled
              </th>
              <th className="text-right py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                Reply Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((seq) => (
              <tr
                key={seq.id}
                className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0"
              >
                <td className="py-3 px-4 font-medium text-neutral-950 dark:text-neutral-50">
                  {seq.name}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      seq.status === "active"
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                        : seq.status === "paused"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
                    )}
                  >
                    {seq.status.charAt(0).toUpperCase() + seq.status.slice(1)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">
                  {seq.total_enrolled}
                </td>
                <td className="py-3 px-4 text-right">
                  <span
                    className={cn(
                      "font-medium",
                      seq.reply_rate >= 20
                        ? "text-green-600 dark:text-green-400"
                        : seq.reply_rate >= 10
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-neutral-600 dark:text-neutral-400",
                    )}
                  >
                    {seq.reply_rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ICPTab({ data }: { data: ICPData[] }) {
  if (data.length === 0) {
    return <EmptyState message="No ICP data available" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((profile) => (
        <Card key={profile.profileId} className="relative overflow-hidden">
          {/* Color accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
            style={{ backgroundColor: profile.color || CHART_COLORS.indigo }}
          />

          <div className="pt-2">
            {/* Profile name */}
            <div className="flex items-center gap-2 mb-4">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{
                  backgroundColor: profile.color || CHART_COLORS.indigo,
                }}
              />
              <h4 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 truncate">
                {profile.name}
              </h4>
            </div>

            {/* Metrics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Matched Leads
                </span>
                <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                  {profile.matchedLeads}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Hot Leads
                </span>
                <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                  {profile.hotLeads}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Avg Match Score
                </span>
                <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                  {profile.avgMatchScore}%
                </span>
              </div>

              {/* Score bar */}
              <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${profile.avgMatchScore}%`,
                    backgroundColor: profile.color || CHART_COLORS.indigo,
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Email Tab ─────────────────────────────────────────────────────────────────

function EmailTab({ data }: { data?: EmailAnalyticsData }) {
  if (!data) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-6">
          <EnvelopeIcon size={32} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          No Email Data Yet
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
          Connect an email account and start sending to see analytics here.
        </p>
      </div>
    );
  }

  const { overview, accounts, dailyVolume } = data;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatBox label="Total Sent" value={overview.totalSent.toLocaleString()} />
        <StatBox label="Delivered" value={overview.totalDelivered.toLocaleString()} />
        <StatBox
          label="Open Rate"
          value={`${overview.openRate}%`}
          subValue={`${overview.totalOpened} opened`}
        />
        <StatBox
          label="Click Rate"
          value={`${overview.clickRate}%`}
          subValue={`${overview.totalClicked} clicked`}
        />
        <StatBox
          label="Reply Rate"
          value={`${overview.replyRate}%`}
          subValue={`${overview.totalReplied} replies`}
        />
        <StatBox
          label="Bounce Rate"
          value={`${overview.bounceRate}%`}
          subValue={`${overview.totalBounced} bounced`}
        />
      </div>

      {/* Daily volume chart */}
      {dailyVolume.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            Daily Email Volume (Last 30 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyVolume}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-neutral-200 dark:text-neutral-800"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  className="text-neutral-500"
                />
                <YAxis tick={{ fontSize: 11 }} className="text-neutral-500" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="sent" fill={CHART_COLORS.indigo} name="Sent" radius={[2, 2, 0, 0]} />
                <Bar dataKey="opened" fill={CHART_COLORS.green} name="Opened" radius={[2, 2, 0, 0]} />
                <Bar dataKey="clicked" fill={CHART_COLORS.amber} name="Clicked" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Account health */}
      {accounts.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            Account Health
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="text-left py-2 font-medium text-neutral-500 dark:text-neutral-400">
                    Account
                  </th>
                  <th className="text-left py-2 font-medium text-neutral-500 dark:text-neutral-400">
                    Provider
                  </th>
                  <th className="text-right py-2 font-medium text-neutral-500 dark:text-neutral-400">
                    Sent Today
                  </th>
                  <th className="text-right py-2 font-medium text-neutral-500 dark:text-neutral-400">
                    Total Sent
                  </th>
                  <th className="text-right py-2 font-medium text-neutral-500 dark:text-neutral-400">
                    Open Rate
                  </th>
                  <th className="text-right py-2 font-medium text-neutral-500 dark:text-neutral-400">
                    Bounce Rate
                  </th>
                  <th className="text-right py-2 font-medium text-neutral-500 dark:text-neutral-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    className="border-b border-neutral-100 dark:border-neutral-800/50"
                  >
                    <td className="py-3 text-neutral-900 dark:text-neutral-100 font-medium">
                      {acc.email}
                    </td>
                    <td className="py-3 text-neutral-500 dark:text-neutral-400 capitalize">
                      {acc.provider}
                    </td>
                    <td className="py-3 text-right text-neutral-900 dark:text-neutral-100">
                      {acc.dailySent}/{acc.dailySendLimit}
                    </td>
                    <td className="py-3 text-right text-neutral-900 dark:text-neutral-100">
                      {acc.totalSent}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={cn(
                          "font-medium",
                          acc.openRate >= 30
                            ? "text-emerald-600"
                            : acc.openRate >= 15
                              ? "text-amber-600"
                              : "text-red-600",
                        )}
                      >
                        {acc.openRate}%
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={cn(
                          "font-medium",
                          acc.bounceRate <= 2
                            ? "text-emerald-600"
                            : acc.bounceRate <= 5
                              ? "text-amber-600"
                              : "text-red-600",
                        )}
                      >
                        {acc.bounceRate}%
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
                          acc.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            acc.status === "active" ? "bg-emerald-500" : "bg-neutral-400",
                          )}
                        />
                        {acc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AnalyticsPageClient({
  pipeline,
  sources,
  forecast,
  winLoss,
  activities,
  funnel,
  sequences,
  icp,
  email,
}: AnalyticsPageClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("pipeline");
  const [aiInsights, setAIInsights] = useState<any>(null);
  const [aiInsightsLoading, setAIInsightsLoading] = useState(false);

  const handleGenerateInsights = async () => {
    setAIInsightsLoading(true);
    try {
      const result = await aiGenerateInsightsSummary();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setAIInsights(result);
      }
    } catch {
      toast.error("Failed to generate AI insights");
    } finally {
      setAIInsightsLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "pipeline":
        return <PipelineTab data={pipeline} />;
      case "sources":
        return <SourcesTab data={sources} />;
      case "forecast":
        return <ForecastTab data={forecast} />;
      case "winloss":
        return <WinLossTab data={winLoss} />;
      case "activity":
        return <ActivityTab data={activities} />;
      case "sequences":
        return <SequencesTab data={sequences} />;
      case "icp":
        return <ICPTab data={icp} />;
      case "email":
        return <EmailTab data={email} />;
      case "ai-insights":
        return (
          <div className="space-y-6">
            {!aiInsights && !aiInsightsLoading && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-6">
                  <SparkleIcon size={32} className="text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  AI-Powered Insights
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-md mx-auto">
                  Get an executive summary of your business health, key metrics, and actionable recommendations powered by AI.
                </p>
                <Button
                  leftIcon={<SparkleIcon size={18} />}
                  onClick={handleGenerateInsights}
                >
                  Generate AI Insights
                </Button>
              </div>
            )}

            {aiInsightsLoading && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <SparkleIcon size={32} className="text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Analyzing your data with AI...</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">This may take 10-15 seconds</p>
              </div>
            )}

            {aiInsights && !aiInsightsLoading && (
              <div className="space-y-6">
                {/* Health Score */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Business Health Score</h3>
                    <button
                      onClick={handleGenerateInsights}
                      className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Regenerate
                    </button>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" className="text-neutral-100 dark:text-neutral-800" />
                        <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={`${(aiInsights.health_score / 100) * 220} 220`} strokeLinecap="round" className={aiInsights.health_score >= 70 ? "text-green-500" : aiInsights.health_score >= 40 ? "text-amber-500" : "text-red-500"} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-neutral-900 dark:text-neutral-100">
                        {aiInsights.health_score}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">{aiInsights.executive_summary}</p>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Key Metrics</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {aiInsights.key_metrics?.map((m: any, i: number) => (
                      <div key={i} className="p-4 rounded bg-neutral-50 dark:bg-neutral-800/50">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{m.metric}</p>
                        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{m.value}</p>
                        <p className={`text-xs mt-1 ${m.trend === "up" ? "text-green-600 dark:text-green-400" : m.trend === "down" ? "text-red-600 dark:text-red-400" : "text-neutral-500"}`}>
                          {m.trend === "up" ? "\u2191" : m.trend === "down" ? "\u2193" : "\u2192"} {m.trend}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Items */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Action Items</h3>
                  <div className="space-y-3">
                    {aiInsights.action_items?.map((item: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded bg-neutral-50 dark:bg-neutral-800/50">
                        <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${item.priority === "high" ? "bg-red-500" : item.priority === "medium" ? "bg-amber-500" : "bg-green-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900 dark:text-neutral-100">{item.action}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.priority === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : item.priority === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                              {item.priority}
                            </span>
                            <span className="text-[10px] text-neutral-500">Impact: {item.impact}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-6 min-h-full">
      {/* Page header */}
      <PageHeader title="Analytics">
        <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          <span>
            <strong className="text-neutral-950 dark:text-neutral-50">
              {funnel.leads}
            </strong>{" "}
            Leads
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <span>
            <strong className="text-neutral-950 dark:text-neutral-50">
              {funnel.deals}
            </strong>{" "}
            Deals
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <span>
            <strong className="text-neutral-950 dark:text-neutral-50">
              {funnel.customers}
            </strong>{" "}
            Customers
          </span>
          <span className="hidden sm:inline text-neutral-300 dark:text-neutral-700">
            |
          </span>
          <span className="hidden sm:inline">
            L-to-D{" "}
            <strong className="text-neutral-950 dark:text-neutral-50">
              {funnel.leadToDealRate}%
            </strong>
          </span>
          <span className="hidden sm:inline">
            D-to-C{" "}
            <strong className="text-neutral-950 dark:text-neutral-50">
              {funnel.dealToCustomerRate}%
            </strong>
          </span>
        </div>
      </PageHeader>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap",
                isActive
                  ? "bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50",
              )}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {renderTabContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
