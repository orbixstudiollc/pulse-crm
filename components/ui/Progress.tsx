import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  color?: "auto" | "green" | "amber" | "red" | "neutral" | "blue" | "yellow";
  size?: "sm" | "md";
  className?: string;
}

function getAutoColor(percentage: number) {
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 50) return "bg-amber-500";
  return "bg-red-500";
}

const colorClasses = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  neutral: "bg-neutral-500",
  blue: "bg-blue-500",
  yellow: "bg-yellow-500",
};

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2",
};

export function Progress({
  value,
  max = 100,
  color = "green",
  size = "md",
  className,
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const barColor =
    color === "auto" ? getAutoColor(percentage) : colorClasses[color];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-full border-[0.5px] border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800",
        sizeClasses[size],
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", barColor)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
