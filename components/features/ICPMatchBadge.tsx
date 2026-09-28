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
    return "bg-success-surface text-success";
  }
  if (grade === "B") {
    return "bg-accent-surface text-accent-on-surface";
  }
  if (grade === "C") {
    return "bg-warning-surface text-warning";
  }
  return "bg-danger-surface text-danger";
}

export function ICPMatchBadge({ score, icpName, compact = false }: ICPMatchBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-fg-secondary">
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
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
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
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        styles,
      )}
    >
      ICP: {score}%{icpName ? ` ${icpName}` : ""}{" "}
      <span className="font-semibold">{grade}</span>
    </span>
  );
}
