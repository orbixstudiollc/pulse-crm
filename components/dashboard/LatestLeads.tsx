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
import { DotsThreeVertical } from "@phosphor-icons/react";
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
  const [dateRange, setDateRange] = useState("this_month");
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
        <h3 className="text-heading-md text-fg">
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
                className="size-4 text-fg-secondary"
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
            <tr className="bg-muted">
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary w-[200px]">
                Lead
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                Source
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                Score
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                Contacted
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary w-[88px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="hover:bg-subtle transition-colors"
              >
                {/* Lead */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <div className="flex items-center gap-3">
                    <Avatar name={lead.name} />
                    <div>
                      <p className="text-[13px] font-medium text-fg">
                        {lead.name}
                      </p>
                      <p className="text-xs text-fg-secondary">
                        {lead.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <Badge variant={leadStatusConfig[lead.status].variant} dot>
                    {leadStatusConfig[lead.status].label}
                  </Badge>
                </td>

                {/* Source */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <span className="text-[13px] text-fg">
                    {lead.source}
                  </span>
                </td>

                {/* Score */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
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
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <span className="text-[13px] text-fg-secondary">
                    {lead.createdDate}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row text-center w-[88px]">
                  <button className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-fg-secondary hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&_svg]:size-3.5">
                    <DotsThreeVertical size={20} weight="bold" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-divider">
        <p className="text-sm text-fg-secondary">
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
              "h-7 rounded-md border border-line bg-surface px-2.5 text-[13px] font-medium text-fg hover:bg-muted transition-colors",
              currentPage === 1 && "opacity-50 cursor-not-allowed",
            )}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <button
            className={cn(
              "h-7 rounded-md border border-line bg-surface px-2.5 text-[13px] font-medium text-fg hover:bg-muted transition-colors",
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
