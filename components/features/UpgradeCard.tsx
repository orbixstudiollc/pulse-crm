import { Button, Progress } from "../ui";

interface UpgradeCardProps {
  current: number;
  max: number;
  label?: string;
}

export function UpgradeCard({
  current,
  max,
  label = "Leads",
}: UpgradeCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-neutral-950 dark:text-neutral-50">{label}</span>
        <span className="text-neutral-500 dark:text-neutral-400">
          {current} / {max}
        </span>
      </div>
      <Progress value={current} max={max} className="mb-3" />
      <Button className="w-full">Upgrade to Unlimited</Button>
    </div>
  );
}
