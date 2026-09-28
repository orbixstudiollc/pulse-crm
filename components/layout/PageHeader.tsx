"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon } from "../ui/Icons";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TabItem {
  label: string;
  href: string;
  active?: boolean;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  tabs?: TabItem[];
  backHref?: string;
  description?: string;
  className?: string;
}

export function PageHeader({
  title,
  breadcrumbs,
  actions,
  tabs,
  backHref,
  description,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950", className)}>
      <div className="px-4 lg:px-8 py-6">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-2 text-sm mb-3">
            {breadcrumbs.map((item, index) => (
              <span key={index} className="flex items-center gap-2">
                {index > 0 && <span className="text-neutral-400">/</span>}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {item.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Title + Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {backHref && (
              <Link
                href={backHref}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              >
                <ArrowLeftIcon size={18} className="text-neutral-600 dark:text-neutral-400" />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-neutral-950 dark:text-neutral-50 truncate">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {description}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="px-4 lg:px-8">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  tab.active
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
