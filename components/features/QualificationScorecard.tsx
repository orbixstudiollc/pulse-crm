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
    { label: "Budget", score: data.bant.budget.score, max: 25, color: "bg-accent-strong" },
    { label: "Authority", score: data.bant.authority.score, max: 25, color: "bg-accent-strong" },
    { label: "Need", score: data.bant.need.score, max: 25, color: "bg-warning" },
    { label: "Timeline", score: data.bant.timeline.score, max: 25, color: "bg-success-fill" },
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

  const gradeColor = grade === "A" ? "text-success bg-success-surface"
    : grade === "B" ? "text-accent-on-surface bg-accent-surface"
    : grade === "C" ? "text-warning bg-warning-surface"
    : "text-danger bg-danger-surface";

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {grade && (
          <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold", gradeColor)}>
            {grade}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-fg-secondary mb-1">
            <span>BANT: {bantTotal}/100</span>
            <span>MEDDIC: {meddicPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-active">
            <div className="h-full rounded-full bg-inverse transition-all" style={{ width: `${score || 0}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-heading-md text-fg">Qualification</h3>
        <div className="flex items-center gap-2">
          {grade && (
            <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold", gradeColor)}>
              {grade}
            </span>
          )}
          <span className="text-sm text-fg-secondary">
            Score: {score ?? 0}/100
          </span>
        </div>
      </div>

      {/* BANT Section */}
      <div className="mb-5">
        <p className="text-xs font-medium text-fg-secondary mb-3">
          BANT ({bantTotal}/100)
        </p>
        <div className="space-y-2.5">
          {bantItems.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-fg-secondary">{item.label}</span>
                <span className="text-xs font-medium text-fg">{item.score}/{item.max}</span>
              </div>
              <div className="h-2 rounded-full bg-active">
                <div className={cn("h-full rounded-full transition-all", item.color)} style={{ width: `${(item.score / item.max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MEDDIC Section */}
      <div>
        <p className="text-xs font-medium text-fg-secondary mb-3">
          MEDDIC ({meddicComplete}/6 — {meddicPct}%)
        </p>
        <div className="space-y-2">
          {meddicChecks.map((check) => (
            <div key={check.label} className="flex items-center gap-2">
              <div className={cn(
                "h-4 w-4 rounded-full border flex items-center justify-center",
                check.done
                  ? "border-success-fill bg-success-fill"
                  : "border-line",
              )}>
                {check.done && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className={cn(
                "text-xs",
                check.done ? "text-fg" : "text-fg-muted",
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
