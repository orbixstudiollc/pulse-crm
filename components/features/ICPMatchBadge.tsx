"use client";

import { cn } from "@/lib/utils";

interface ICPMatchBadgeProps {
  score: number | null;
  icpName?: string;
  compact?: boolean;
}

function getGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function getGradeStyles(grade: string): string {
  if (grade === "A+" || grade === "A") {
    return "border-green-200 dark:border-green-400/30 bg-green-100 text-green-600 dark:bg-green-400/15 dark:text-green-400";
  }
  if (grade === "B") {
    return "border-blue-200 dark:border-blue-400/30 bg-blue-100 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400";
  }
  if (grade === "C") {
    return "border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400";
  }
  return "border-red-200 dark:border-red-400/30 bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-400";
}

export function ICPMatchBadge({ score, icpName, compact = false }: ICPMatchBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] px-2.5 py-1 text-xs font-medium border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 text-neutral-500 dark:bg-neutral-400/15 dark:text-neutral-400">
        No ICP Match
      </span>
    );
  }

  const grade = getGrade(score);
  const styles = getGradeStyles(grade);

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border-[0.5px] px-2 py-0.5 text-xs font-medium",
          styles,
        )}
      >
        {score}% {grade}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-[0.5px] px-2.5 py-1 text-xs font-medium",
        styles,
      )}
    >
      ICP: {score}%{icpName ? ` ${icpName}` : ""}{" "}
      <span className="font-bold">{grade}</span>
    </span>
  );
}
