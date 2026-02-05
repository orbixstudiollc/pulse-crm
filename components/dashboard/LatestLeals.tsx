"use client";

import { useState } from "react";
import {
  ArrowUpRightIcon,
  IconButton,
  Button,
  Badge,
  Dropdown,
  dateRangeOptions,
  Avatar,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  leads as allLeads,
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
  leads = allLeads.slice(0, 6),
  totalLeads = allLeads.length,
  className,
}: LatestLeadsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState("this_month");
  const leadsPerPage = 6;
  const startIndex = (currentPage - 1) * leadsPerPage + 1;
  const endIndex = Math.min(currentPage * leadsPerPage, totalLeads);

  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          Latest Leads
        </h3>

        <div className="flex items-center gap-2">
          <Dropdown
            options={dateRangeOptions}
            value={dateRange}
            onChange={setDateRange}
          />

          <IconButton
            icon={
              <ArrowUpRightIcon
                size={20}
                className="text-neutral-600 dark:text-neutral-400"
              />
            }
            aria-label="View all leads"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                Lead
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Status
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Source
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Score
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Contacted
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                {/* Lead */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={lead.name} />
                    <div>
                      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                        {lead.name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {lead.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <Badge variant={leadStatusConfig[lead.status].variant} dot>
                    {leadStatusConfig[lead.status].label}
                  </Badge>
                </td>

                {/* Source */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {lead.source}
                  </span>
                </td>

                {/* Score */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-[0.5px] text-sm font-semibold",
                      getLeadScoreStyle(lead.score),
                    )}
                  >
                    {lead.score}
                  </div>
                </td>

                {/* Contacted */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {lead.createdDate}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-200 dark:border-neutral-800">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Showing{" "}
          <span className="font-medium text-neutral-950 dark:text-neutral-50">
            {startIndex}-{endIndex}
          </span>{" "}
          of{" "}
          <span className="font-medium text-neutral-950 dark:text-neutral-50">
            {totalLeads}
          </span>{" "}
          leads
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={endIndex >= totalLeads}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
