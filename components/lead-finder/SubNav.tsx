"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Campaigns", href: "/dashboard/lead-finder/campaigns" },
  { name: "All Leads", href: "/dashboard/lead-finder/leads" },
  { name: "Costs", href: "/dashboard/lead-finder/costs" },
];

export function LeadFinderSubNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 rounded-lg bg-[#141417] p-1 mb-6">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-white text-black"
                : "text-[#a0a0a8] hover:text-white"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
