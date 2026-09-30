"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, Badge, Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  leadStatusConfig,
  getLeadScoreStyle,
  type Lead,
} from "@/lib/data/leads";

interface LatestLeadsProps {
  leads?: Lead[];
  totalLeads?: number;
  className?: string;
}

export function LatestLeads({
  leads = [],
  totalLeads = 0,
  className,
}: LatestLeadsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 6;
  const startIndex = (currentPage - 1) * leadsPerPage + 1;
  const endIndex = Math.min(currentPage * leadsPerPage, totalLeads);

  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h3 className="text-[16px] leading-6 font-semibold text-fg">
          Latest Leads
        </h3>

        <Link
          href="/dashboard/leads"
          aria-label="View all leads"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-fg-secondary transition-colors duration-150 hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          <ArrowUpRightIcon size={20} className="size-4 text-fg-secondary" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider w-[200px]">
                Lead
              </th>
              <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                Status
              </th>
              <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                Source
              </th>
              <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                Score
              </th>
              <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                Contacted
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="h-10 border-b border-divider last:border-b-0 hover:bg-subtle transition-colors"
              >
                {/* Lead */}
                <td className="px-3 py-2 text-[14px] text-fg">
                  <div className="flex items-center gap-3">
                    <Avatar name={lead.name} />
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <p className="text-[14px] font-medium text-fg hover:underline">
                        {lead.name}
                      </p>
                      <p className="text-[13px] text-fg-secondary">
                        {lead.email}
                      </p>
                    </Link>
                  </div>
                </td>

                {/* Status */}
                <td className="px-3 py-2 text-[14px] text-fg">
                  <Badge variant={leadStatusConfig[lead.status].variant} dot>
                    {leadStatusConfig[lead.status].label}
                  </Badge>
                </td>

                {/* Source */}
                <td className="px-3 py-2 text-[14px] text-fg">
                  <span className="text-[14px] text-fg">
                    {lead.source}
                  </span>
                </td>

                {/* Score */}
                <td className="px-3 py-2 text-[14px] text-fg">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium",
                      getLeadScoreStyle(lead.score),
                    )}
                  >
                    {lead.score}
                  </div>
                </td>

                {/* Contacted */}
                <td className="px-3 py-2 text-[14px] text-fg">
                  <span className="text-[13px] text-fg-secondary">
                    {lead.createdDate}
                  </span>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-divider">
        <p className="text-[13px] text-fg-muted">
          Showing{" "}
          <span className="font-medium text-fg">
            {startIndex}&ndash;{endIndex}
          </span>{" "}
          of{" "}
          <span className="font-medium text-fg">
            {totalLeads}
          </span>{" "}
          leads
        </p>

        <div className="flex items-center gap-2">
          <button
            className={cn(
              "h-8 rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-fg hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              currentPage === 1 && "opacity-50 cursor-not-allowed",
            )}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <button
            className={cn(
              "h-8 rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-fg hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              endIndex >= totalLeads && "opacity-50 cursor-not-allowed",
            )}
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={endIndex >= totalLeads}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
