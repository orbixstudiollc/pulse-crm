import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export function Progress({ value, max = 100, className }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={cn(
        "h-2 overflow-hidden rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-green-500 transition-all"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
