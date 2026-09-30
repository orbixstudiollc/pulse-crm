import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  color?: "auto" | "green" | "amber" | "red" | "neutral" | "blue" | "yellow";
  size?: "sm" | "md";
  className?: string;
}

function getAutoColor(percentage: number) {
  if (percentage >= 80) return "bg-success-fill";
  if (percentage >= 50) return "bg-warning";
  return "bg-danger";
}

const colorClasses = {
  green: "bg-success-fill",
  amber: "bg-warning",
  red: "bg-danger",
  neutral: "bg-fg-muted",
  blue: "bg-accent",
  yellow: "bg-warning",
};

const sizeClasses = {
  sm: "h-1",
  md: "h-1.5",
};

export function Progress({
  value,
  max = 100,
  color = "blue",
  size = "md",
  className,
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const barColor =
    color === "auto" ? getAutoColor(percentage) : colorClasses[color];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-full bg-active",
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
