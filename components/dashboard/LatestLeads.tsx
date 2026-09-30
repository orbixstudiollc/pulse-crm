"use client";

import Link from "next/link";
import { Badge, Avatar } from "@/components/ui";
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
  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th className="text-left">Lead</th>
              <th className="text-left">Status</th>
              <th className="text-left">Source</th>
              <th className="text-left">Score</th>
              <th className="text-left">Contacted</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="transition-colors">
                {/* Lead */}
                <td className="text-[14px] text-fg">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={lead.name} size="xs" className="shrink-0" />
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="flex min-w-0 items-baseline gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span className="whitespace-nowrap text-[14px] font-medium text-fg hover:underline">
                        {lead.name}
                      </span>
                      <span className="truncate text-[13px] text-fg-muted">
                        {lead.email}
                      </span>
                    </Link>
                  </div>
                </td>

                {/* Status */}
                <td className="text-[14px] text-fg">
                  <Badge variant={leadStatusConfig[lead.status].variant} dot>
                    {leadStatusConfig[lead.status].label}
                  </Badge>
                </td>

                {/* Source */}
                <td className="text-[14px] text-fg">{lead.source}</td>

                {/* Score */}
                <td className="text-[14px] text-fg">
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium",
                      getLeadScoreStyle(lead.score),
                    )}
                  >
                    {lead.score}
                  </div>
                </td>

                {/* Contacted */}
                <td className="whitespace-nowrap text-[13px] text-fg-secondary">
                  {lead.createdDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {leads.length > 0 && (
        <div className="flex h-12 items-center px-8 max-sm:px-4 text-[13px] text-fg-muted">
          Showing {leads.length} of {totalLeads} leads
        </div>
      )}
    </div>
  );
}
