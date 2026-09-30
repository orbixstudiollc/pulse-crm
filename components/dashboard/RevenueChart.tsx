"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { chartAccent, chartGrid, chartSurface, axisTick } from "@/lib/design-system/chart-colors";

interface DataPoint {
  month: string;
  revenue: number;
}

interface RevenueChartProps {
  data?: DataPoint[];
  className?: string;
}

const defaultData: DataPoint[] = [
  { month: "Aug", revenue: 125000 },
  { month: "Sep", revenue: 30000 },
  { month: "Oct", revenue: 140000 },
  { month: "Nov", revenue: 110000 },
  { month: "Jan", revenue: 200000 },
  { month: "Feb", revenue: 160000 },
  { month: "Mar", revenue: 70000 },
  { month: "Apr", revenue: 85000 },
];

const formatYAxis = (value: number) => {
  if (value === 0) return "0K";
  return `${value / 1000}K`;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="flex items-center gap-4 rounded-md border border-line bg-surface shadow-dropdown px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-xs bg-chart-1" />
        <span className="text-xs text-fg-secondary">
          Revenue
        </span>
      </div>

      <span className="text-xs font-semibold text-fg">
        {formatCurrency(payload[0].value)}
      </span>
    </div>
  );
}

export function RevenueChart({
  data = defaultData,
  className,
}: RevenueChartProps) {
  return (
    <div className={cn("px-8 pt-4 max-sm:px-4", className)}>
      {/* Chart */}
      <div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={chartAccent}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={chartAccent}
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke={chartGrid}
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={axisTick}
              dy={10}
              tickMargin={8}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={axisTick}
              tickFormatter={formatYAxis}
              domain={[0, 250000]}
              ticks={[0, 50000, 100000, 150000, 200000, 250000]}
              width={70}
              tickMargin={24}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                strokeWidth: 1,
                strokeDasharray: "4 4",
                className: "stroke-chart-axis",
              }}
            />

            <Area
              type="natural"
              dataKey="revenue"
              stroke={chartAccent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{
                r: 5,
                fill: chartAccent,
                stroke: chartSurface,
                strokeWidth: 2,
              }}
              animationDuration={1200}
              animationEasing="ease-out"
              animationBegin={0}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
