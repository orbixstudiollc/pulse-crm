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
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-fg">{label}</span>
        <span className="text-fg-secondary">
          {current} / {max}
        </span>
      </div>

      <Progress value={current} max={max} className="mb-3" />
      <Button className="w-full">Upgrade to Unlimited</Button>
    </div>
  );
}
