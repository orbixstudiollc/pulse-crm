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
  ChartBarIcon,
  FunnelIcon,
  CurrencyDollarIcon,
  TrophyIcon,
  ActivityIcon,
  PulseIcon,
  CrosshairIcon,
  GlobeIcon,
  SparkleIcon,
  EnvelopeIcon,
  ChatCircleIcon,
  WhatsappLogoIcon,
  LinkedinLogoIcon,
} from "@/components/ui";
import {
  Page,
  PageHeader,
  PageTabs,
  MetricStrip,
  Metric,
  Section,
  TableSection,
  EmptyState as PageEmptyState,
} from "@/components/dashboard";
import { cn } from "@/lib/utils";
import { chartSeries, chartGrid, chartTooltipStyle, axisTick } from "@/lib/design-system/chart-colors";
import { formatCurrency } from "@/lib/utils";
import { parseLocalDate } from "@/lib/utils/local-date";
import { aiGenerateInsightsSummary, aiAnalyzePipeline, aiIdentifyRisks, aiPredictForecast } from "@/lib/actions/ai-analytics";
import type { EmailOverviewStats, AccountHealth, DailyEmailVolume } from "@/lib/actions/email-analytics";

// ── Types ────────────────────────────────────────────────────────────────────

type InsightsSummary = Exclude<Awaited<ReturnType<typeof aiGenerateInsightsSummary>>, { error: string }>;

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
    id: string;
    name: string;
    company: string | null;
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

interface ChannelAnalyticsData {
  email: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  };
  whatsapp: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    deliveryRate: number;
    readRate: number;
    replyRate: number;
  };
  linkedin: {
    total: number;
    connections: number;
    messages: number;
    profileViews: number;
    endorsements: number;
    accepted: number;
    replied: number;
    acceptRate: number;
    replyRate: number;
  };
  dailyVolume: {
    date: string;
    email: number;
    whatsapp: number;
    linkedin: number;
  }[];
  summary: {
    totalOutreach: number;
    totalReplies: number;
    overallReplyRate: number;
    bestChannel: string;
  };
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
  channels?: ChannelAnalyticsData;
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
  { id: "channels", label: "Channels", icon: ChatCircleIcon },
  { id: "ai-insights", label: "AI Insights", icon: SparkleIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CHART_COLORS = {
  indigo: chartSeries[0],
  green: chartSeries[1],
  amber: chartSeries[2],
  red: chartSeries[3],
  purple: chartSeries[4],
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

function StatBox({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return <Metric label={label} value={value} hint={subValue} />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-fg-secondary">
        {message}
      </p>
    </div>
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
    <div className="rounded-md border border-line bg-surface shadow-dropdown px-3 py-2">
      <p className="text-xs font-medium text-fg-secondary mb-1">
        {label}
      </p>
      {payload.map((entry, i) => (
        <p
          key={i}
          className="text-sm font-semibold text-fg"
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
    <div>
      {/* Stats row */}
      <MetricStrip className="pt-6">
        <StatBox label="Total Deals" value={String(data.totalDeals)} />
        <StatBox
          label="Avg Deal Value"
          value={formatCurrency(data.avgDealValue)}
        />
      </MetricStrip>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-divider">
        {/* Deal count per stage */}
        <Section title="Deals by Stage">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke={chartGrid} />
                <XAxis
                  dataKey="name"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Total value per stage */}
        <Section title="Value by Stage" className="lg:border-t-0 lg:border-l">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke={chartGrid} />
                <XAxis
                  dataKey="name"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                  className="text-fg-secondary"
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v) => formatCurrency(v)}
                    />
                  }
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="totalValue" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
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
    <div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Lead count by source */}
        <Section title="Leads by Source">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke={chartGrid} />
                <XAxis
                  dataKey="name"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Avg score by source */}
        <Section title="Avg Score by Source" className="lg:border-t-0 lg:border-l">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke={chartGrid} />
                <XAxis
                  dataKey="name"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="avgScore" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* Table */}
      <TableSection title="Source Details" className="border-t border-divider">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-[13px] font-medium text-fg-secondary">
                  Source
                </th>
                <th className="text-right text-[13px] font-medium text-fg-secondary">
                  Leads
                </th>
                <th className="text-right text-[13px] font-medium text-fg-secondary">
                  Avg Score
                </th>
                <th className="text-right text-[13px] font-medium text-fg-secondary">
                  Hot Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((source) => (
                <tr
                  key={source.source}
                  className="hover:bg-subtle transition-colors"
                >
                  <td className="py-2 font-medium text-fg">
                    <div className="flex items-center gap-2">
                      <GlobeIcon size={16} className="shrink-0 text-fg-muted" />
                      {source.source}
                    </div>
                  </td>
                  <td className="py-2 text-right text-fg-secondary">
                    {source.count}
                  </td>
                  <td className="py-2 text-right text-fg-secondary">
                    {source.avgScore}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        source.hotRate >= 50
                          ? "bg-success-surface text-success"
                          : source.hotRate >= 25
                            ? "bg-warning-surface text-warning"
                            : "bg-muted text-fg-secondary",
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
      </TableSection>
    </div>
  );
}

function ForecastTab({ data }: { data: ForecastData }) {
  if (data.deals.length === 0) {
    return <EmptyState message="No forecast data available" />;
  }

  return (
    <div>
      {/* Big number */}
      <MetricStrip className="pt-6">
        <StatBox
          label="Weighted Pipeline Value"
          value={formatCurrency(data.weighted)}
        />
      </MetricStrip>

      {/* Deals table */}
      <TableSection title="Forecast Deals" className="border-t border-divider">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-[13px] font-medium text-fg-secondary">
                  Deal
                </th>
                <th className="text-left text-[13px] font-medium text-fg-secondary">
                  Stage
                </th>
                <th className="text-right text-[13px] font-medium text-fg-secondary">
                  Value
                </th>
                <th className="text-right text-[13px] font-medium text-fg-secondary">
                  Probability
                </th>
                <th className="text-right text-[13px] font-medium text-fg-secondary">
                  Weighted
                </th>
                <th className="text-right text-[13px] font-medium text-fg-secondary">
                  Expected Close
                </th>
              </tr>
            </thead>
            <tbody>
              {data.deals.map((deal) => (
                <tr
                  key={deal.id}
                  className="hover:bg-subtle transition-colors"
                >
                  <td className="py-2">
                    <p className="font-medium text-fg">{deal.name}</p>
                    {deal.company && (
                      <p className="text-[12px] text-fg-muted">{deal.company}</p>
                    )}
                  </td>
                  <td className="py-2">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor:
                          `color-mix(in srgb, ${STAGE_COLORS[deal.stage] || CHART_COLORS.indigo} 10%, transparent)`,
                        color:
                          STAGE_COLORS[deal.stage] || CHART_COLORS.indigo,
                      }}
                    >
                      {formatStageName(deal.stage)}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium text-fg">
                    {formatCurrency(deal.value)}
                  </td>
                  <td className="py-2 text-right text-fg-secondary">
                    {deal.probability}%
                  </td>
                  <td className="py-2 text-right font-medium text-fg">
                    {formatCurrency(deal.weightedValue)}
                  </td>
                  <td className="py-2 text-right text-fg-secondary">
                    {deal.expectedClose
                      ? (parseLocalDate(deal.expectedClose)?.toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        ) ?? "--")
                      : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableSection>
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
    <div>
      {/* Stats */}
      <MetricStrip className="pt-6">
        <StatBox label="Won" value={String(data.won)} />
        <StatBox label="Lost" value={String(data.lost)} />
        <StatBox label="Win Rate" value={`${data.winRate}%`} />
        <StatBox
          label="Avg Won Value"
          value={formatCurrency(data.avgWonValue)}
        />
        <StatBox
          label="Avg Lost Value"
          value={formatCurrency(data.avgLostValue)}
        />
      </MetricStrip>

      {/* Visual comparison */}
      <Section title="Win vs Loss Distribution">
        <div className="space-y-4">
          {/* Won bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-fg">
                Won
              </span>
              <span className="text-fg-secondary">
                {data.won} deals ({wonPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
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
              <span className="font-medium text-fg">
                Lost
              </span>
              <span className="text-fg-secondary">
                {data.lost} deals ({lostPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
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
          <Metric
            label="Avg Won Deal"
            value={<span className="text-success">{formatCurrency(data.avgWonValue)}</span>}
          />
          <Metric
            label="Avg Lost Deal"
            value={<span className="text-danger">{formatCurrency(data.avgLostValue)}</span>}
          />
        </div>
      </Section>
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
    <div>
      {/* Stats */}
      <MetricStrip className="pt-6">
        <StatBox
          label="Total Activities (Last 30 Days)"
          value={String(data.total)}
          subValue={`${Object.keys(data.byType).length} activity types`}
        />
      </MetricStrip>

      {/* Chart */}
      <Section title="Activities by Type">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke={chartGrid} />
              <XAxis
                dataKey="name"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "transparent" }}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}

function SequencesTab({ data }: { data: SequenceData[] }) {
  if (data.length === 0) {
    return <EmptyState message="No sequence data available" />;
  }

  return (
    <TableSection title="Sequence Performance">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-[13px] font-medium text-fg-secondary">
                Sequence
              </th>
              <th className="text-left text-[13px] font-medium text-fg-secondary">
                Status
              </th>
              <th className="text-right text-[13px] font-medium text-fg-secondary">
                Enrolled
              </th>
              <th className="text-right text-[13px] font-medium text-fg-secondary">
                Reply Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((seq) => (
              <tr
                key={seq.id}
                className="hover:bg-subtle transition-colors"
              >
                <td className="py-2 font-medium text-fg">
                  <div className="flex items-center gap-2">
                    <PulseIcon size={16} className="shrink-0 text-fg-muted" />
                    {seq.name}
                  </div>
                </td>
                <td className="py-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      seq.status === "active"
                        ? "bg-success-surface text-success"
                        : seq.status === "paused"
                          ? "bg-warning-surface text-warning"
                          : "bg-muted text-fg-secondary",
                    )}
                  >
                    {seq.status.charAt(0).toUpperCase() + seq.status.slice(1)}
                  </span>
                </td>
                <td className="py-2 text-right text-fg-secondary">
                  {seq.total_enrolled}
                </td>
                <td className="py-2 text-right">
                  <span
                    className={cn(
                      "font-medium",
                      seq.reply_rate >= 20
                        ? "text-success"
                        : seq.reply_rate >= 10
                          ? "text-warning"
                          : "text-fg-secondary",
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
    </TableSection>
  );
}

function ICPTab({ data }: { data: ICPData[] }) {
  if (data.length === 0) {
    return <EmptyState message="No ICP data available" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((profile) => (
        <Section
          key={profile.profileId}
          title={profile.name}
          icon={
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{
                backgroundColor: profile.color || CHART_COLORS.indigo,
              }}
            />
          }
          className="border-t-0 border-b sm:max-lg:odd:border-r lg:[&:not(:nth-child(3n))]:border-r"
        >
          {/* Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-secondary">
              Matched Leads
            </span>
            <span className="text-sm font-semibold text-fg">
              {profile.matchedLeads}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-secondary">
              Hot Leads
            </span>
            <span className="text-sm font-semibold text-fg">
              {profile.hotLeads}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-secondary">
              Avg Match Score
            </span>
            <span className="text-sm font-semibold text-fg">
              {profile.avgMatchScore}%
            </span>
          </div>

          {/* Score bar */}
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${profile.avgMatchScore}%`,
                backgroundColor: profile.color || CHART_COLORS.indigo,
              }}
            />
          </div>
            </div>
        </Section>
      ))}
    </div>
  );
}

// ── Email Tab ─────────────────────────────────────────────────────────────────

function EmailTab({ data }: { data?: EmailAnalyticsData }) {
  if (!data) {
    return (
      <PageEmptyState
        icon={<EnvelopeIcon size={24} />}
        title="No Email Data Yet"
        description="Connect an email account and start sending to see analytics here."
      />
    );
  }

  const { overview, accounts, dailyVolume } = data;
  const hasEmailActivity = Object.values(overview).some((v) => v > 0);

  return (
    <div>
      {!hasEmailActivity ? (
        <PageEmptyState
          icon={<EnvelopeIcon size={24} />}
          title="No emails sent yet"
          description="Email metrics appear once emails are sent from Pulse. Emails logged as activities are not counted here."
        />
      ) : (
        <>
          {/* KPI row */}
          <MetricStrip className="pt-6">
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
          </MetricStrip>

          {/* Daily volume chart */}
          {dailyVolume.length > 0 && (
            <Section title="Daily Email Volume (Last 30 Days)">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyVolume}>
                    <CartesianGrid vertical={false} stroke={chartGrid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => {
                        // 'YYYY-MM-DD' keys: new Date() would read UTC midnight
                        const d = parseLocalDate(v);
                        return d ? `${d.getMonth() + 1}/${d.getDate()}` : v;
                      }}
                      className="text-fg-secondary"
                    />
                    <YAxis axisLine={false} tickLine={false} tick={axisTick} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                    />
                    <Bar dataKey="sent" fill={CHART_COLORS.indigo} name="Sent" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="opened" fill={CHART_COLORS.green} name="Opened" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="clicked" fill={CHART_COLORS.amber} name="Clicked" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}
        </>
      )}

      {/* Account health */}
      {accounts.length > 0 && (
        <TableSection title="Account Health" className="border-t border-divider">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-[13px] font-medium text-fg-secondary">
                    Account
                  </th>
                  <th className="text-left text-[13px] font-medium text-fg-secondary">
                    Provider
                  </th>
                  <th className="text-right text-[13px] font-medium text-fg-secondary">
                    Sent Today
                  </th>
                  <th className="text-right text-[13px] font-medium text-fg-secondary">
                    Total Sent
                  </th>
                  <th className="text-right text-[13px] font-medium text-fg-secondary">
                    Open Rate
                  </th>
                  <th className="text-right text-[13px] font-medium text-fg-secondary">
                    Bounce Rate
                  </th>
                  <th className="text-right text-[13px] font-medium text-fg-secondary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    className="hover:bg-subtle transition-colors"
                  >
                    <td className="py-2 text-fg font-medium">
                      <div className="flex items-center gap-2">
                        <EnvelopeIcon size={16} className="shrink-0 text-fg-muted" />
                        {acc.email}
                      </div>
                    </td>
                    <td className="py-2 text-fg-secondary capitalize">
                      {acc.provider}
                    </td>
                    <td className="py-2 text-right text-fg">
                      {acc.dailySent}/{acc.dailySendLimit}
                    </td>
                    <td className="py-2 text-right text-fg">
                      {acc.totalSent}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={cn(
                          "font-medium",
                          acc.openRate >= 30
                            ? "text-success"
                            : acc.openRate >= 15
                              ? "text-warning"
                              : "text-danger",
                        )}
                      >
                        {acc.openRate}%
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={cn(
                          "font-medium",
                          acc.bounceRate <= 2
                            ? "text-success"
                            : acc.bounceRate <= 5
                              ? "text-warning"
                              : "text-danger",
                        )}
                      >
                        {acc.bounceRate}%
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
                          acc.status === "active"
                            ? "bg-success-surface text-success"
                            : "bg-muted text-fg-secondary",
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            acc.status === "active" ? "bg-success" : "bg-fg-muted",
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
        </TableSection>
      )}
    </div>
  );
}

// ── Channels Tab ─────────────────────────────────────────────────────────────

const CHANNEL_COLORS = {
  email: chartSeries[0],
  whatsapp: chartSeries[1],
  linkedin: chartSeries[4],
};

function ChannelsTab({ data }: { data?: ChannelAnalyticsData }) {
  if (!data) {
    return (
      <PageEmptyState
        icon={<ChatCircleIcon size={24} />}
        title="No Channel Data"
        description="Channel analytics will appear here once you start sending messages across Email, WhatsApp, and LinkedIn."
      />
    );
  }

  const channelComparison = [
    {
      channel: "Email",
      sent: data.email.sent,
      replies: data.email.replied,
      replyRate: data.email.replyRate,
    },
    {
      channel: "WhatsApp",
      sent: data.whatsapp.sent,
      replies: data.whatsapp.replied,
      replyRate: data.whatsapp.replyRate,
    },
    {
      channel: "LinkedIn",
      sent: data.linkedin.messages + data.linkedin.connections,
      replies: data.linkedin.replied,
      replyRate: data.linkedin.replyRate,
    },
  ];

  const channelDistribution = [
    { name: "Email", value: data.email.total, color: CHANNEL_COLORS.email },
    { name: "WhatsApp", value: data.whatsapp.total, color: CHANNEL_COLORS.whatsapp },
    { name: "LinkedIn", value: data.linkedin.total, color: CHANNEL_COLORS.linkedin },
  ];

  const totalMessages = channelDistribution.reduce((s, c) => s + c.value, 0);
  const hasReplies = channelComparison.some((c) => c.replies > 0);

  return (
    <div>
      {/* Summary stats */}
      <MetricStrip className="pt-6">
        <StatBox
          label="Total Outreach"
          value={data.summary.totalOutreach.toLocaleString()}
          subValue="Last 30 days"
        />
        <StatBox
          label="Total Replies"
          value={data.summary.totalReplies.toLocaleString()}
          subValue="Across all channels"
        />
        <StatBox
          label="Overall Reply Rate"
          value={`${data.summary.overallReplyRate}%`}
          subValue="Combined average"
        />
        {hasReplies ? (
          <Metric
            label="Best Channel"
            value={
              <div className="flex items-center gap-2">
                {data.summary.bestChannel === "email" && (
                  <EnvelopeIcon size={20} className="text-accent-strong" />
                )}
                {data.summary.bestChannel === "whatsapp" && (
                  <WhatsappLogoIcon size={20} className="text-success" />
                )}
                {data.summary.bestChannel === "linkedin" && (
                  <LinkedinLogoIcon size={20} className="text-accent-strong" />
                )}
                <span className="capitalize">{data.summary.bestChannel}</span>
              </div>
            }
            hint="Highest reply rate"
          />
        ) : (
          <StatBox label="Best Channel" value="—" subValue="Not enough data" />
        )}
      </MetricStrip>

      {/* Channel distribution bar */}
      <Section title="Channel Distribution">
        {totalMessages > 0 ? (
          <>
            <div className="flex h-4 rounded-full overflow-hidden bg-muted">
              {channelDistribution.map((ch) => (
                <div
                  key={ch.name}
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${(ch.value / totalMessages) * 100}%`,
                    backgroundColor: ch.color,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-6 mt-3">
              {channelDistribution.map((ch) => (
                <div key={ch.name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ch.color }}
                  />
                  <span className="text-xs text-fg-secondary">
                    {ch.name}{" "}
                    <strong className="text-fg">
                      {ch.value}
                    </strong>{" "}
                    ({totalMessages > 0 ? Math.round((ch.value / totalMessages) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-fg-secondary">No messages sent yet.</p>
        )}
      </Section>

      {/* Daily Volume Chart */}
      {data.dailyVolume.length > 0 && (
        <Section title="Daily Volume by Channel">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.dailyVolume} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke={chartGrid} />
              <XAxis
                dataKey="date"
                tick={axisTick}
                tickFormatter={(v: string) => {
                  const d = new Date(v + "T00:00:00");
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} />
              <Tooltip
                contentStyle={chartTooltipStyle}
              />
              <Bar dataKey="email" name="Email" fill={CHANNEL_COLORS.email} radius={[2, 2, 0, 0]} />
              <Bar dataKey="whatsapp" name="WhatsApp" fill={CHANNEL_COLORS.whatsapp} radius={[2, 2, 0, 0]} />
              <Bar dataKey="linkedin" name="LinkedIn" fill={CHANNEL_COLORS.linkedin} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Channel Comparison */}
      <Section title="Channel Comparison — Reply Rates">
        {!hasReplies ? (
          <PageEmptyState
            icon={<ChatCircleIcon size={24} />}
            title="No replies yet"
            description="Reply rates by channel appear here once contacts reply to your outreach."
          />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={channelComparison} layout="vertical" barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={chartGrid} />
              <XAxis axisLine={false} tickLine={false} type="number" tick={axisTick} unit="%" />
              <YAxis axisLine={false} tickLine={false}
                type="category"
                dataKey="channel"
                tick={axisTick}
                width={80}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: unknown) => [`${value}%`, "Reply Rate"]}
              />
              <Bar dataKey="replyRate" name="Reply Rate" radius={[0, 2, 2, 0]}>
                {channelComparison.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      entry.channel === "Email"
                        ? CHANNEL_COLORS.email
                        : entry.channel === "WhatsApp"
                          ? CHANNEL_COLORS.whatsapp
                          : CHANNEL_COLORS.linkedin
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Per-channel detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 border-t border-divider">
        {/* Email detail */}
        <Section title="Email" icon={<EnvelopeIcon size={16} className="text-accent-strong" />} className="lg:border-t-0">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Sent</span>
              <span className="font-medium text-fg">{data.email.sent}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Opened</span>
              <span className="font-medium text-fg">
                {data.email.opened} ({data.email.openRate}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Clicked</span>
              <span className="font-medium text-fg">
                {data.email.clicked} ({data.email.clickRate}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Replied</span>
              <span className="font-medium text-success">
                {data.email.replied} ({data.email.replyRate}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Bounced</span>
              <span className="font-medium text-danger">{data.email.bounced}</span>
            </div>
          </div>
        </Section>

        {/* WhatsApp detail */}
        <Section title="WhatsApp" icon={<WhatsappLogoIcon size={16} className="text-success" />} className="lg:border-t-0 lg:border-l">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Sent</span>
              <span className="font-medium text-fg">{data.whatsapp.sent}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Delivered</span>
              <span className="font-medium text-fg">
                {data.whatsapp.delivered} ({data.whatsapp.deliveryRate}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Read</span>
              <span className="font-medium text-fg">
                {data.whatsapp.read} ({data.whatsapp.readRate}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Replied</span>
              <span className="font-medium text-success">
                {data.whatsapp.replied} ({data.whatsapp.replyRate}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Failed</span>
              <span className="font-medium text-danger">{data.whatsapp.failed}</span>
            </div>
          </div>
        </Section>

        {/* LinkedIn detail */}
        <Section title="LinkedIn" icon={<LinkedinLogoIcon size={16} className="text-accent-strong" />} className="lg:border-t-0 lg:border-l">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Connections Sent</span>
              <span className="font-medium text-fg">{data.linkedin.connections}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Accepted</span>
              <span className="font-medium text-fg">
                {data.linkedin.accepted} ({data.linkedin.acceptRate}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Messages Sent</span>
              <span className="font-medium text-fg">{data.linkedin.messages}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Replied</span>
              <span className="font-medium text-success">
                {data.linkedin.replied} ({data.linkedin.replyRate}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Profile Views</span>
              <span className="font-medium text-fg">{data.linkedin.profileViews}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-fg-secondary">Endorsements</span>
              <span className="font-medium text-fg">{data.linkedin.endorsements}</span>
            </div>
          </div>
        </Section>
      </div>
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
  channels,
}: AnalyticsPageClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("pipeline");
  const [aiInsights, setAIInsights] = useState<InsightsSummary | null>(null);
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
      case "channels":
        return <ChannelsTab data={channels} />;
      case "ai-insights":
        return (
          <div>
            {!aiInsights && !aiInsightsLoading && (
              <PageEmptyState
                icon={<SparkleIcon size={24} />}
                title="AI-Powered Insights"
                description="Get an executive summary of your business health, key metrics, and actionable recommendations powered by AI."
                actions={[
                  {
                    label: "Generate AI Insights",
                    icon: <SparkleIcon size={18} />,
                    onClick: handleGenerateInsights,
                    variant: "primary",
                  },
                ]}
              />
            )}

            {aiInsightsLoading && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-accent-surface flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <SparkleIcon size={32} className="text-accent-strong" />
                </div>
                <p className="text-sm text-fg-secondary">Analyzing your data with AI...</p>
                <p className="text-xs text-fg-muted mt-1">This may take 10-15 seconds</p>
              </div>
            )}

            {aiInsights && !aiInsightsLoading && (
              <div>
                {/* Health Score */}
                <Section
                  title="Business Health Score"
                  actions={
                    <button
                      onClick={handleGenerateInsights}
                      className="text-xs text-accent-strong hover:underline"
                    >
                      Regenerate
                    </button>
                  }
                >
                  <div className="flex items-center gap-6">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
                        <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={`${(aiInsights.health_score / 100) * 220} 220`} strokeLinecap="round" className={aiInsights.health_score >= 70 ? "text-success" : aiInsights.health_score >= 40 ? "text-warning" : "text-danger"} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-fg">
                        {aiInsights.health_score}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-fg">{aiInsights.executive_summary}</p>
                    </div>
                  </div>
                </Section>

                {/* Key Metrics */}
                <Section title="Key Metrics">
                  <div className="flex flex-wrap gap-x-10 gap-y-4">
                    {aiInsights.key_metrics?.map((m, i) => (
                      <Metric
                        key={i}
                        label={m.metric}
                        value={m.value}
                        change={{
                          value: `${m.trend === "up" ? "\u2191" : m.trend === "down" ? "\u2193" : "\u2192"} ${m.trend}`,
                          trend: m.trend === "up" ? "up" : m.trend === "down" ? "down" : "neutral",
                        }}
                      />
                    ))}
                  </div>
                </Section>

                {/* Action Items */}
                <Section title="Action Items">
                  <div className="divide-y divide-divider">
                    {aiInsights.action_items?.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${item.priority === "high" ? "bg-danger" : item.priority === "medium" ? "bg-warning" : "bg-success"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-fg">{item.action}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.priority === "high" ? "bg-danger-surface text-danger" : item.priority === "medium" ? "bg-warning-surface text-warning" : "bg-success-surface text-success"}`}>
                              {item.priority}
                            </span>
                            <span className="text-xs text-fg-secondary">Impact: {item.impact}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Page>
      {/* Page header */}
      <PageHeader title="Analytics" icon={<ChartBarIcon size={18} />}>
        <div className="flex items-center gap-3 text-sm text-fg-secondary">
          <span>
            <strong className="text-fg">
              {funnel.leads}
            </strong>{" "}
            Leads
          </span>
          <span className="text-fg-disabled">/</span>
          <span>
            <strong className="text-fg">
              {funnel.deals}
            </strong>{" "}
            Deals
          </span>
          <span className="text-fg-disabled">/</span>
          <span>
            <strong className="text-fg">
              {funnel.customers}
            </strong>{" "}
            Customers
          </span>
          <span className="hidden sm:inline text-fg-disabled">
            |
          </span>
          <span className="hidden sm:inline">
            L-to-D{" "}
            <strong className="text-fg">
              {funnel.leadToDealRate}%
            </strong>
          </span>
          <span className="hidden sm:inline">
            D-to-C{" "}
            <strong className="text-fg">
              {funnel.dealToCustomerRate}%
            </strong>
          </span>
        </div>
      </PageHeader>

      {/* Tab navigation */}
      <PageTabs
        tabs={TABS.map((tab) => {
          const Icon = tab.icon;
          return { id: tab.id, label: tab.label, icon: <Icon size={16} /> };
        })}
        value={activeTab}
        onChange={setActiveTab}
        className="overflow-x-auto overflow-y-hidden"
      />

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
    </Page>
  );
}
