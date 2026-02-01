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
import {
  CalendarBlankIcon,
  CaretDownIcon,
  ArrowUpRightIcon,
  Button,
  IconButton,
} from "@/components/ui";
import { cn } from "@/lib/utils";

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
    <div className="flex items-center gap-4 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-1 shadow-lg">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-xs bg-blue-500" />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          Revenue
        </span>
      </div>

      <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
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
    <div
      className={cn(
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          Revenue Trend
        </h3>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            leftIcon={<CalendarBlankIcon size={20} />}
            rightIcon={<CaretDownIcon size={20} />}
          >
            This Year
          </Button>

          <IconButton
            icon={<ArrowUpRightIcon size={20} />}
            aria-label="Open in new tab"
          />
        </div>
      </div>

      {/* Chart */}
      <div className="p-6 pt-6">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(217, 91%, 60%)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(217, 91%, 60%)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              vertical={false}
              stroke="hsl(0, 0%, 90%)"
              className="stroke-neutral-200 dark:stroke-neutral-800"
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              dy={10}
              tickMargin={8}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
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
                className: "stroke-neutral-950 dark:stroke-white",
              }}
            />

            <Area
              type="natural"
              dataKey="revenue"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{
                r: 5,
                fill: "hsl(217, 91%, 60%)",
                stroke: "#fff",
                strokeWidth: 2,
                className: "stroke-white dark:stroke-neutral-950",
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
