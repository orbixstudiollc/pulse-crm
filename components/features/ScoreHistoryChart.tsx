"use client";

import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  YAxis,
} from "recharts";

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
    <div className="rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
        {score}
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
    return (
      <div
        className="flex items-center justify-center text-xs text-neutral-400 dark:text-neutral-500"
        style={{ height }}
      >
        No score history
      </div>
    );
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
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
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
            stroke="#22c55e"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="url(#scoreGradient)"
            dot={false}
            activeDot={{
              r: 4,
              fill: "#22c55e",
              stroke: "#fff",
              strokeWidth: 2,
              className: "stroke-white dark:stroke-neutral-950",
            }}
            animationDuration={800}
            animationEasing="ease-out"
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
