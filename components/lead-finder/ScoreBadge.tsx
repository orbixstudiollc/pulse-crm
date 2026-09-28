"use client";

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-success bg-success-surface"
      : score >= 60
        ? "text-success bg-success-surface"
        : score >= 40
          ? "text-warning bg-warning-surface"
          : score > 0
            ? "text-danger bg-danger-surface"
            : "bg-muted text-fg-secondary";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {score}
    </span>
  );
}
