"use client";

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-400 bg-emerald-400/10"
      : score >= 60
        ? "text-green-400 bg-green-400/10"
        : score >= 40
          ? "text-amber-400 bg-amber-400/10"
          : score > 0
            ? "text-red-400 bg-red-400/10"
            : "text-[#a0a0a8] bg-[#232329]";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {score}
    </span>
  );
}
