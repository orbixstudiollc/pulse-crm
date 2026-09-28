"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Overview", href: "/dashboard/lead-finder/overview" },
  { name: "Campaigns", href: "/dashboard/lead-finder/campaigns" },
  { name: "All Leads", href: "/dashboard/lead-finder/leads" },
  { name: "Costs", href: "/dashboard/lead-finder/costs" },
  { name: "Settings", href: "/dashboard/lead-finder/settings" },
];

export function LeadFinderSubNav() {
  const pathname = usePathname();
  return (
    <div className="inline-flex h-8 items-center gap-0.5 rounded-md bg-muted p-0.5 mb-6 max-w-full overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex h-7 items-center rounded-sm px-3 text-[13px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isActive
                ? "bg-surface text-fg"
                : "text-fg-secondary hover:text-fg"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
