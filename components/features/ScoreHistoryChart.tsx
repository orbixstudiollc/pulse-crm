"use client";

import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { chartSuccess, chartSurface } from "@/lib/design-system/chart-colors";

// ── Types ────────────────────────────────────────────────────────────────────

interface ScoreHistoryChartProps {
  history: Array<{
    score: number;
    scored_at: string;
  }>;
  height?: number;
  width?: number;
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { score: number; scored_at: string } }>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SparklineTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const { score, scored_at } = payload[0].payload;

  return (
    <div className="rounded-md border border-line bg-surface shadow-dropdown px-2 py-1.5">
      <p className="text-sm font-semibold text-fg">
        {score}
      </p>
      <p className="text-xs text-fg-secondary">
        {formatDate(scored_at)}
      </p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScoreHistoryChart({
  history,
  height = 60,
  width,
}: ScoreHistoryChartProps) {
  if (!history || history.length === 0) {
    return <p className="text-[13px] text-fg-muted">No score history</p>;
  }

  // Sort chronologically (oldest first) for the chart
  const sorted = [...history].sort(
    (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime(),
  );

  return (
    <div style={{ width: width ?? "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sorted} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartSuccess} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartSuccess} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <YAxis domain={[0, 100]} hide />

          <Tooltip
            content={<SparklineTooltip />}
            cursor={false}
          />

          <Area
            type="monotone"
            dataKey="score"
            stroke={chartSuccess}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="url(#scoreGradient)"
            dot={false}
            activeDot={{
              r: 4,
              fill: chartSuccess,
              stroke: chartSurface,
              strokeWidth: 2,
            }}
            animationDuration={200}
            animationEasing="ease-out"
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
