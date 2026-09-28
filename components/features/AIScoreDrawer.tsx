"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SparkleIcon,
  XIcon,
  CheckCircleIcon,
  WarningIcon,
} from "@/components/ui/Icons";
import { aiScoreLead } from "@/lib/actions/ai-scoring";
import type { AIScoreResult } from "@/lib/ai/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface AIScoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  currentScore?: number | null;
  onScoreApplied?: (score: number) => void;
}

type ScoringState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: AIScoreResult }
  | { status: "error"; message: string };

// ── Dimension metadata ───────────────────────────────────────────────────────

const DIMENSION_CONFIG: {
  key: keyof AIScoreResult["dimensions"];
  label: string;
}[] = [
  { key: "fit", label: "Fit" },
  { key: "engagement", label: "Engagement" },
  { key: "intent", label: "Intent" },
  { key: "timing", label: "Timing" },
  { key: "budget", label: "Budget" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-danger";
}

function scoreRingColor(score: number): string {
  if (score >= 70) return "stroke-success";
  if (score >= 40) return "stroke-warning";
  return "stroke-danger";
}

function scoreTrackColor(): string {
  return "stroke-chart-grid";
}

function barColor(value: number): string {
  if (value >= 70) return "bg-success-fill";
  if (value >= 40) return "bg-warning";
  return "bg-danger";
}

// ── Score Circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          className={scoreTrackColor()}
        />
        <motion.circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={scoreRingColor(score)}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`text-xl font-semibold ${scoreColor(score)}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-fg-secondary">
          / 100
        </span>
      </div>
    </div>
  );
}

// ── Dimension Bar ────────────────────────────────────────────────────────────

function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-secondary">
          {label}
        </span>
        <span className="text-sm font-medium text-fg">
          {value}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-active">
        <motion.div
          className={`h-2 rounded-full ${barColor(value)}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── Loading Spinner ──────────────────────────────────────────────────────────

function LoadingSpinner({ leadName }: { leadName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
      >
        <SparkleIcon
          size={36}
          weight="fill"
          className="text-accent-strong"
        />
      </motion.div>
      <div className="text-center">
        <p className="text-sm font-medium text-fg">
          Analyzing {leadName}...
        </p>
        <p className="mt-1 text-xs text-fg-secondary">
          AI is evaluating lead data and scoring dimensions
        </p>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AIScoreDrawer({
  isOpen,
  onClose,
  leadId,
  leadName,
  currentScore,
  onScoreApplied,
}: AIScoreDrawerProps) {
  const [state, setState] = useState<ScoringState>({ status: "idle" });

  const runScoring = useCallback(async () => {
    setState({ status: "loading" });

    try {
      const result = await aiScoreLead(leadId);

      if ("error" in result) {
        setState({ status: "error", message: result.error });
        return;
      }

      setState({ status: "success", result });
      onScoreApplied?.(result.score);
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "An unexpected error occurred",
      });
    }
  }, [leadId, onScoreApplied]);

  // Trigger scoring when the drawer opens
  useEffect(() => {
    if (isOpen) {
      runScoring();
    } else {
      // Reset state when drawer is closed
      setState({ status: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col border-l border-line bg-surface"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-divider px-4">
              <div className="flex items-center gap-2">
                <SparkleIcon
                  size={20}
                  weight="fill"
                  className="text-accent-strong"
                />
                <h2 className="text-heading-md text-fg">
                  AI Lead Score
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-muted hover:text-fg"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Loading */}
              {state.status === "loading" && (
                <LoadingSpinner leadName={leadName} />
              )}

              {/* Error */}
              {state.status === "error" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-surface">
                    <WarningIcon
                      size={24}
                      className="text-danger"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-fg">
                      Scoring Failed
                    </p>
                    <p className="mt-1 max-w-[280px] text-xs text-fg-secondary">
                      {state.message}
                    </p>
                  </div>
                  <button
                    onClick={runScoring}
                    className="mt-2 h-8 rounded-md bg-accent-strong px-3 text-sm font-medium text-on-inverse transition-opacity hover:opacity-90"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Success */}
              {state.status === "success" && (
                <motion.div
                  className="space-y-6"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Lead name + badge */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-fg-secondary">
                        Lead
                      </p>
                      <p className="text-base font-semibold text-fg">
                        {leadName}
                      </p>
                    </div>
                    {currentScore != null && (
                      <div className="text-right">
                        <p className="text-xs text-fg-secondary">
                          Previous
                        </p>
                        <p className="text-sm font-medium text-fg-secondary">
                          {currentScore}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Score circle */}
                  <div className="flex justify-center">
                    <ScoreCircle score={state.result.score} />
                  </div>

                  {/* Score applied badge */}
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-surface px-2 py-0.5 text-xs font-medium text-success">
                      <CheckCircleIcon size={14} weight="fill" />
                      Score Applied
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-divider" />

                  {/* Dimension breakdown */}
                  <div>
                    <h3 className="mb-3 text-heading-sm text-fg">
                      Score Breakdown
                    </h3>
                    <div className="space-y-3">
                      {DIMENSION_CONFIG.map(({ key, label }) => (
                        <DimensionBar
                          key={key}
                          label={label}
                          value={state.result.dimensions[key]}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-divider" />

                  {/* Reasoning */}
                  {state.result.reasoning && (
                    <div>
                      <h3 className="mb-2 text-heading-sm text-fg">
                        AI Reasoning
                      </h3>
                      <p className="text-sm leading-relaxed text-fg-secondary">
                        {state.result.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Recommendations */}
                  {state.result.recommendations.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-heading-sm text-fg">
                        Recommendations
                      </h3>
                      <ul className="space-y-2">
                        {state.result.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-strong" />
                            <span className="text-sm text-fg-secondary">
                              {rec}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
