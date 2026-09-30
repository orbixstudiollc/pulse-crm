"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Clay page kit. Recipes come from docs/design/clay-layout.md.

interface Children {
  children?: ReactNode;
  className?: string;
}

export function Page({ children, className }: Children) {
  return <div className={cn("min-h-full pb-10", className)}>{children}</div>;
}

export function MetricStrip({ children, className }: Children) {
  return (
    <div className={cn("flex flex-wrap gap-x-10 gap-y-4 px-8 pb-6 max-sm:px-4", className)}>
      {children}
    </div>
  );
}

interface MetricProps {
  label: string;
  value: ReactNode;
  change?: {
    value: string;
    trend: "up" | "down" | "neutral" | "flat";
  };
  hint?: string;
  className?: string;
}

// Only numeric changes ("+12%", "-3", "5") read as "... from last month"; text like "New this month" stands alone.
const HAS_NUMERIC_CHANGE = /^[+-]?\d/;

export function Metric({ label, value, change, hint, className }: MetricProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[13px] text-fg-muted">{label}</p>
      <div className="mt-1 text-[18px] leading-6 font-semibold text-fg">{value}</div>
      {change && (
        <p className="mt-1 text-[12px]">
          <span
            className={cn(
              "font-medium",
              change.trend === "up" && "text-success",
              change.trend === "down" && "text-danger",
              (change.trend === "neutral" || change.trend === "flat") && "text-fg-muted",
            )}
          >
            {change.value}
          </span>
          {HAS_NUMERIC_CHANGE.test(change.value) && (
            <span className="text-fg-muted"> from last month</span>
          )}
        </p>
      )}
      {hint && <p className="mt-1 text-[12px] text-fg-muted">{hint}</p>}
    </div>
  );
}

interface PageTabsProps<T extends string> {
  tabs: { id: T; label: string; icon?: ReactNode; count?: number | string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function PageTabs<T extends string>({ tabs, value, onChange, className }: PageTabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn("flex items-end gap-6 px-8 border-b border-divider overflow-x-auto overflow-y-hidden max-sm:px-4", className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&_svg]:size-4",
              isActive ? "text-accent-strong" : "text-fg hover:text-fg-secondary",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && <span className="text-fg-muted">{tab.count}</span>}
            {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

interface TableSectionProps extends Children {
  title?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
}

export function TableSection({ title, actions, flush, children, className }: TableSectionProps) {
  return (
    <div className={className}>
      {(title || actions) && (
        <div className="flex h-14 items-center justify-between gap-4 px-8 max-sm:px-4">
          {title ? <h2 className="text-[18px] leading-6 font-semibold text-fg">{title}</h2> : <span />}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("clay-table", flush && "clay-table-flush")}>{children}</div>
    </div>
  );
}

interface SectionProps extends Children {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  id?: string;
}

export function Section({ title, description, icon, actions, children, className, id }: SectionProps) {
  const hasHeading = title || description || actions;
  return (
    <section
      id={id}
      className={cn("px-8 py-6 border-t border-divider first:border-t-0 max-sm:px-4", className)}
    >
      {hasHeading && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-[16px] leading-6 font-semibold text-fg">
                {icon && <span className="flex shrink-0 text-fg-secondary [&_svg]:size-4">{icon}</span>}
                {title}
              </h2>
            )}
            {description && <div className="mt-0.5 text-[13px] text-fg-muted">{description}</div>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

interface DetailLayoutProps extends Children {
  aside?: ReactNode;
}

export function DetailLayout({ children, aside, className }: DetailLayoutProps) {
  return (
    <div className={cn("flex max-lg:flex-col", className)}>
      <div className="flex-1 min-w-0">{children}</div>
      {aside && (
        <aside className="w-[320px] shrink-0 border-l border-divider max-lg:w-full max-lg:border-l-0 max-lg:border-t">
          {aside}
        </aside>
      )}
    </div>
  );
}

interface PanelSectionProps {
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PanelSection({ title, actions, children }: PanelSectionProps) {
  return (
    <div className="px-6 py-5 border-t border-divider first:border-t-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function KeyValueList({ children }: { children?: ReactNode }) {
  return <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">{children}</dl>;
}

export function KeyValue({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return (
    <>
      <dt className="pr-3 text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </>
  );
}
