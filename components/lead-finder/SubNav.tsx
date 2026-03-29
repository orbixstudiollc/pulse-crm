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
    <div className="flex gap-0 border-b border-neutral-200 dark:border-neutral-800 mb-6 -mx-6 lg:-mx-8 px-6 lg:px-8">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              isActive
                ? "border-neutral-950 dark:border-white text-neutral-950 dark:text-white"
                : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
