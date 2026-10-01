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
    <div className="flex items-end gap-6 border-b border-divider overflow-x-auto overflow-y-hidden">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative inline-flex h-10 shrink-0 items-center whitespace-nowrap text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              isActive ? "text-accent-strong" : "text-fg hover:text-fg-secondary"
            }`}
          >
            {tab.name}
            {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
          </Link>
        );
      })}
    </div>
  );
}
