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
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

function scoreRingColor(score: number): string {
  if (score >= 70) return "stroke-emerald-500";
  if (score >= 40) return "stroke-amber-500";
  return "stroke-red-500";
}

function scoreTrackColor(): string {
  return "stroke-neutral-200 dark:stroke-neutral-700";
}

function barColor(value: number): string {
  if (value >= 70) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
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
          className={`text-3xl font-bold ${scoreColor(score)}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
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
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {label}
        </span>
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {value}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
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
          className="text-violet-500"
        />
      </motion.div>
      <div className="text-center">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Analyzing {leadName}...
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
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
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col border-l border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <SparkleIcon
                  size={20}
                  weight="fill"
                  className="text-violet-500"
                />
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  AI Lead Score
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Loading */}
              {state.status === "loading" && (
                <LoadingSpinner leadName={leadName} />
              )}

              {/* Error */}
              {state.status === "error" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <WarningIcon
                      size={24}
                      className="text-red-500"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Scoring Failed
                    </p>
                    <p className="mt-1 max-w-[280px] text-xs text-neutral-500 dark:text-neutral-400">
                      {state.message}
                    </p>
                  </div>
                  <button
                    onClick={runScoring}
                    className="mt-2 rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
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
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Lead
                      </p>
                      <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                        {leadName}
                      </p>
                    </div>
                    {currentScore != null && (
                      <div className="text-right">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Previous
                        </p>
                        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
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
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircleIcon size={14} weight="fill" />
                      Score Applied
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-neutral-200 dark:border-neutral-700" />

                  {/* Dimension breakdown */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
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
                  <div className="border-t border-neutral-200 dark:border-neutral-700" />

                  {/* Reasoning */}
                  {state.result.reasoning && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        AI Reasoning
                      </h3>
                      <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                        {state.result.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Recommendations */}
                  {state.result.recommendations.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Recommendations
                      </h3>
                      <ul className="space-y-2">
                        {state.result.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500" />
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">
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
