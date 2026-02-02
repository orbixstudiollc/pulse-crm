"use client";

import { useState } from "react";
import {
  CalendarBlankIcon,
  CaretDownIcon,
  ArrowUpRightIcon,
  DotsThreeVerticalIcon,
  IconButton,
  Button,
  Badge,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type LeadStatus = "hot" | "warm" | "cold";

interface Lead {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: LeadStatus;
  source: string;
  score: number;
  contacted: string;
}

interface LatestLeadsProps {
  leads?: Lead[];
  totalLeads?: number;
  className?: string;
}

const defaultLeads: Lead[] = [
  {
    id: "1",
    name: "John Smith",
    email: "john@example.com",
    status: "hot",
    source: "Website",
    score: 92,
    contacted: "2 hours ago",
  },
  {
    id: "2",
    name: "Emily Davis",
    email: "emily@startup.io",
    status: "warm",
    source: "Referral",
    score: 78,
    contacted: "1 day ago",
  },
  {
    id: "3",
    name: "Michael Brown",
    email: "mbrown@corp.com",
    status: "hot",
    source: "LinkedIn",
    score: 88,
    contacted: "3 hours ago",
  },
  {
    id: "4",
    name: "Sarah Wilson",
    email: "sarah@design.co",
    status: "cold",
    source: "Event",
    score: 45,
    contacted: "1 day ago",
  },
  {
    id: "5",
    name: "David Lee",
    email: "dlee@enterprise.com",
    status: "warm",
    source: "Website",
    score: 72,
    contacted: "2 days ago",
  },
  {
    id: "6",
    name: "Jennifer Taylor",
    email: "jtaylor@stars.co",
    status: "cold",
    source: "LinkedIn",
    score: 40,
    contacted: "3 days ago",
  },
];

const statusConfig: Record<
  LeadStatus,
  { label: string; variant: "red" | "amber" | "neutral" }
> = {
  hot: { label: "Hot", variant: "red" },
  warm: { label: "Warm", variant: "amber" },
  cold: { label: "Cold", variant: "neutral" },
};

function getScoreStyle(score: number) {
  if (score >= 80) {
    return "border-green-200 dark:border-green-500/30 bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400";
  }
  if (score >= 60) {
    return "border-amber-200 dark:border-amber-500/30 bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400";
  }
  return "border-neutral-200 dark:border-neutral-500/30 bg-neutral-100 text-neutral-500 dark:bg-neutral-500/15 dark:text-neutral-400";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function LatestLeads({
  leads = defaultLeads,
  totalLeads = 156,
  className,
}: LatestLeadsProps) {
  const [currentPage, setCurrentPage] = useState(1);
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
          <Button
            variant="outline"
            leftIcon={<CalendarBlankIcon size={16} />}
            rightIcon={<CaretDownIcon size={16} />}
          >
            This Month
          </Button>

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
              <th className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Actions
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
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      {getInitials(lead.name)}
                    </div>
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
                  <Badge variant={statusConfig[lead.status].variant} dot>
                    {statusConfig[lead.status].label}
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
                      getScoreStyle(lead.score),
                    )}
                  >
                    {lead.score}
                  </div>
                </td>

                {/* Contacted */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {lead.contacted}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-3 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <div className="flex justify-center">
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                      <DotsThreeVerticalIcon
                        size={20}
                        className="text-neutral-500"
                      />
                    </button>
                  </div>
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
