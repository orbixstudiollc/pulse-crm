"use client";

import { ReactNode } from "react";
import { Metric } from "./Page";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: string;
    trend: "up" | "down" | "neutral" | "flat";
  };
  hint?: string;
  icon: ReactNode;
  className?: string;
}

// `icon` stays in the props so existing call sites compile; the flat Metric look does not render it.
export function StatCard({
  label,
  value,
  change,
  hint,
  className,
}: StatCardProps) {
  return (
    <Metric
      label={label}
      value={value}
      change={change}
      hint={hint}
      className={className}
    />
  );
}
