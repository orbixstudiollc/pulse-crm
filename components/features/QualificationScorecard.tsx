"use client";

import { cn } from "@/lib/utils";
import type { QualificationData } from "@/lib/actions/qualification";

interface QualificationScorecardProps {
  data: QualificationData;
  grade: string | null;
  score: number | null;
  compact?: boolean;
}

export function QualificationScorecard({ data, grade, score, compact }: QualificationScorecardProps) {
  const bantItems = [
    { label: "Budget", score: data.bant.budget.score, max: 25, color: "bg-blue-500" },
    { label: "Authority", score: data.bant.authority.score, max: 25, color: "bg-violet-500" },
    { label: "Need", score: data.bant.need.score, max: 25, color: "bg-amber-500" },
    { label: "Timeline", score: data.bant.timeline.score, max: 25, color: "bg-green-500" },
  ];

  const bantTotal = bantItems.reduce((sum, item) => sum + item.score, 0);

  // MEDDIC completeness
  const meddicChecks = [
    { label: "Metrics", done: !!data.meddic.metrics.confidence },
    { label: "Economic Buyer", done: data.meddic.economic_buyer.identified },
    { label: "Decision Criteria", done: data.meddic.decision_criteria.criteria.length > 0 },
    { label: "Decision Process", done: !!data.meddic.decision_process.type },
    { label: "Identify Pain", done: data.meddic.identify_pain.pains.length > 0 },
    { label: "Champion", done: data.meddic.champion.identified },
  ];
  const meddicComplete = meddicChecks.filter(c => c.done).length;
  const meddicPct = Math.round((meddicComplete / 6) * 100);

  const gradeColor = grade === "A" ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-400/15 border-green-200 dark:border-green-400/30"
    : grade === "B" ? "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-400/15 border-blue-200 dark:border-blue-400/30"
    : grade === "C" ? "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/15 border-amber-200 dark:border-amber-400/30"
    : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-400/15 border-red-200 dark:border-red-400/30";

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {grade && (
          <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold", gradeColor)}>
            {grade}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            <span>BANT: {bantTotal}/100</span>
            <span>MEDDIC: {meddicPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div className="h-full rounded-full bg-neutral-900 dark:bg-neutral-100 transition-all" style={{ width: `${score || 0}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50">Qualification</h3>
        <div className="flex items-center gap-2">
          {grade && (
            <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold", gradeColor)}>
              {grade}
            </span>
          )}
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Score: {score ?? 0}/100
          </span>
        </div>
      </div>

      {/* BANT Section */}
      <div className="mb-5">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
          BANT ({bantTotal}/100)
        </p>
        <div className="space-y-2.5">
          {bantItems.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-600 dark:text-neutral-400">{item.label}</span>
                <span className="text-xs font-medium text-neutral-950 dark:text-neutral-50">{item.score}/{item.max}</span>
              </div>
              <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className={cn("h-full rounded-full transition-all", item.color)} style={{ width: `${(item.score / item.max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MEDDIC Section */}
      <div>
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
          MEDDIC ({meddicComplete}/6 — {meddicPct}%)
        </p>
        <div className="space-y-2">
          {meddicChecks.map((check) => (
            <div key={check.label} className="flex items-center gap-2">
              <div className={cn(
                "h-4 w-4 rounded-full border flex items-center justify-center",
                check.done
                  ? "border-green-500 bg-green-500"
                  : "border-neutral-300 dark:border-neutral-700",
              )}>
                {check.done && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className={cn(
                "text-xs",
                check.done ? "text-neutral-950 dark:text-neutral-50" : "text-neutral-400 dark:text-neutral-500",
              )}>
                {check.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
