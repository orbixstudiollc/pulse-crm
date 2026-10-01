"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { SegmentedControl } from "@/components/ui";
import { TableSection } from "./Page";

type OverviewSegment = "leads" | "deals" | "activity" | "revenue";

interface OverviewTabsProps {
  leads: ReactNode;
  deals: ReactNode;
  activity: ReactNode;
  revenue: ReactNode;
  counts?: { leads?: number; deals?: number; activity?: number };
}

const SEGMENTS: { value: OverviewSegment; label: string; href: string }[] = [
  { value: "leads", label: "Latest leads", href: "/dashboard/leads" },
  { value: "deals", label: "Active deals", href: "/dashboard/sales" },
  { value: "activity", label: "Activity", href: "/dashboard/activity" },
  { value: "revenue", label: "Revenue", href: "/dashboard/analytics" },
];

export function OverviewTabs({ leads, deals, activity, revenue, counts }: OverviewTabsProps) {
  const [segment, setSegment] = useState<OverviewSegment>("leads");
  const current = SEGMENTS.find((s) => s.value === segment) ?? SEGMENTS[0];
  const panels: Record<OverviewSegment, ReactNode> = { leads, deals, activity, revenue };
  const segmentCounts: Partial<Record<OverviewSegment, number>> = counts ?? {};

  return (
    <div>
      <div className="mt-8 px-8 max-sm:px-4">
        <SegmentedControl
          aria-label="Overview sections"
          value={segment}
          onChange={setSegment}
          options={SEGMENTS.map((s) => ({ value: s.value, label: s.label, count: segmentCounts[s.value] }))}
          className="max-w-full overflow-x-auto"
        />
      </div>

      <TableSection
        className="mt-2"
        title={current.label}
        actions={
          <Link
            href={current.href}
            className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-fg transition-colors duration-150 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page"
          >
            View all
          </Link>
        }
      >
        {panels[segment]}
      </TableSection>
    </div>
  );
}
