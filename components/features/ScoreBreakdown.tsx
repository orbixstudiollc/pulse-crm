"use client";

import { Progress } from "@/components/ui";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ScoreBreakdownProps {
  breakdown: {
    company_size_score: number;
    industry_fit_score: number;
    engagement_score: number;
    source_quality_score: number;
    budget_score: number;
    total: number;
    weights: {
      company_size: number;
      industry_fit: number;
      engagement: number;
      source_quality: number;
      budget: number;
    };
  } | null;
  compact?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

function getScoreBg(score: number) {
  if (score >= 75) return "bg-success-surface";
  if (score >= 50) return "bg-warning-surface";
  return "bg-danger-surface";
}

function getProgressColor(score: number): "green" | "amber" | "red" {
  if (score >= 75) return "green";
  if (score >= 50) return "amber";
  return "red";
}

const factors = [
  { key: "company_size_score", weightKey: "company_size", label: "Company Size" },
  { key: "industry_fit_score", weightKey: "industry_fit", label: "Industry Fit" },
  { key: "engagement_score", weightKey: "engagement", label: "Engagement" },
  { key: "source_quality_score", weightKey: "source_quality", label: "Source Quality" },
  { key: "budget_score", weightKey: "budget", label: "Budget Signals" },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function ScoreBreakdown({ breakdown, compact = false }: ScoreBreakdownProps) {
  if (!breakdown) {
    return <p className="text-[13px] text-fg-muted">No score data available</p>;
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Compact overall score */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-2xl font-semibold tabular-nums",
              getScoreColor(breakdown.total),
            )}
          >
            {breakdown.total}
          </span>
          <span className="text-xs text-fg-secondary">/ 100</span>
        </div>

        {/* Mini bars */}
        <div className="space-y-2">
          {factors.map((factor) => (
            <div key={factor.key} className="flex items-center gap-2">
              <div className="flex-1">
                <Progress
                  value={breakdown[factor.key]}
                  color={getProgressColor(breakdown[factor.key])}
                  size="sm"
                />
              </div>
              <span className="text-xs tabular-nums text-fg-secondary w-7 text-right">
                {breakdown[factor.key]}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overall score */}
      <div
        className={cn(
          "flex items-center gap-4 rounded-lg p-4",
          getScoreBg(breakdown.total),
        )}
      >
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums leading-none",
            getScoreColor(breakdown.total),
          )}
        >
          {breakdown.total}
        </span>
        <div>
          <p className="text-sm font-medium text-fg">
            Lead Score
          </p>
          <p className="text-xs text-fg-secondary">
            {breakdown.total >= 75
              ? "High quality lead"
              : breakdown.total >= 50
                ? "Moderate potential"
                : "Needs attention"}
          </p>
        </div>
      </div>

      {/* Factor bars */}
      <div className="space-y-4">
        {factors.map((factor) => {
          const score = breakdown[factor.key];
          const weight = breakdown.weights[factor.weightKey];

          return (
            <div key={factor.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-fg">
                  {factor.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-fg-muted">
                    {weight}% weight
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      getScoreColor(score),
                    )}
                  >
                    {score}
                  </span>
                </div>
              </div>
              <Progress
                value={score}
                color={getProgressColor(score)}
                size="md"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
