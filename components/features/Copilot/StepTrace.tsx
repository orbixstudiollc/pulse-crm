"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CheckIcon, CircleNotchIcon, WarningIcon, XIcon } from "@/components/ui/Icons";

export type StepStatus = "running" | "done" | "failed" | "denied" | "stale";

export type TraceStep = {
  id: string;
  label: string;
  status: StepStatus;
  /** Outcome text shown under the label (error, stale-record or limit message). */
  detail?: string;
  /** Muted side note, e.g. "Automations not triggered". */
  note?: string;
  /** Trailing control, e.g. the undo button. */
  action?: ReactNode;
};

const STATUS_ICON: Record<StepStatus, { icon: typeof CheckIcon; className: string }> = {
  running: { icon: CircleNotchIcon, className: "animate-spin text-fg-muted" },
  done: { icon: CheckIcon, className: "text-success" },
  failed: { icon: XIcon, className: "text-danger" },
  denied: { icon: XIcon, className: "text-fg-muted" },
  stale: { icon: WarningIcon, className: "text-warning" },
};

/** One hairline-separated row per tool call the assistant made. */
export function StepTrace({ steps }: { steps: TraceStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ul className="border-t border-divider" aria-label="Steps">
      {steps.map((step) => {
        const { icon: Icon, className } = STATUS_ICON[step.status];
        return (
          <li key={step.id} className="flex items-start gap-2 border-b border-divider py-2 text-[13px]">
            <Icon size={14} className={cn("mt-0.5 shrink-0", className)} />
            <div className="min-w-0 flex-1">
              <span className="text-fg">{step.label}</span>
              {step.note && <span className="ml-2 text-fg-muted">{step.note}</span>}
              {step.detail && <p className="mt-0.5 text-fg-secondary">{step.detail}</p>}
            </div>
            {step.action}
          </li>
        );
      })}
    </ul>
  );
}
