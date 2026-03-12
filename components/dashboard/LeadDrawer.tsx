"use client";

import {
  Avatar,
  Badge,
  Button,
  Drawer,
  PencilSimpleIcon,
} from "@/components/ui";
import { EyeIcon } from "@/components/ui";
import { ScoreBreakdown } from "@/components/features/ScoreBreakdown";
import { QualificationScorecard } from "@/components/features/QualificationScorecard";
import type { QualificationData } from "@/lib/actions/qualification";
import {
  type Lead,
  leadQualificationConfig,
  leadStatusConfig,
} from "@/lib/data/leads";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface LeadDrawerProps {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onEdit?: () => void;
}

export function LeadDrawer({ open, onClose, lead, onEdit }: LeadDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Lead Details"
      footer={
        lead ? (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              leftIcon={<PencilSimpleIcon size={18} />}
              onClick={() => {
                onClose();
                onEdit?.();
              }}
            >
              Edit Lead
            </Button>

            <Link href={`/dashboard/leads/${lead.id}`} className="flex-1">
              <Button className="w-full" leftIcon={<EyeIcon size={18} />}>
                View Full Details
              </Button>
            </Link>
          </div>
        ) : null
      }
    >
      {lead ? (
        <>
          {/* Profile Header */}
          <div className="flex items-center gap-4 mb-6">
            <Avatar name={lead.name} size="xl" />
            <div>
              <h3 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50">
                {lead.name}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {lead.company}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                Est. Value
              </p>
              <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
                ${lead.estimatedValue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                Health Score
              </p>
              <p className={cn(
                "text-3xl font-serif",
                lead.score >= 75
                  ? "text-green-600 dark:text-green-400"
                  : lead.score >= 50
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400",
              )}>
                {lead.score}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                Win Probability
              </p>
              <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
                {lead.winProbability}%
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                Days in Pipeline
              </p>
              <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
                {lead.daysInPipeline}
              </p>
            </div>
          </div>

          {/* Score Breakdown */}
          {lead.scoreBreakdown && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                Score Breakdown
              </h4>
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
                <ScoreBreakdown
                  breakdown={
                    typeof lead.scoreBreakdown === "string"
                      ? JSON.parse(lead.scoreBreakdown as string)
                      : (lead.scoreBreakdown as any)
                  }
                  compact
                />
              </div>
            </div>
          )}

          {/* Qualification Scorecard */}
          {lead.qualificationData && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                Qualification
              </h4>
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
                <QualificationScorecard
                  data={
                    typeof lead.qualificationData === "string"
                      ? JSON.parse(lead.qualificationData)
                      : (lead.qualificationData as QualificationData)
                  }
                  grade={lead.qualificationGrade ?? null}
                  score={lead.qualificationScore ?? null}
                  compact
                />
              </div>
            </div>
          )}

          {/* Lead Information */}
          <div className="mb-6">
            <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Lead Information
            </h4>
            <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-800">
              <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Status
                </span>
                <Badge variant={leadStatusConfig[lead.status].variant}>
                  {leadQualificationConfig[lead.status].label}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-3 last:pb-0">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Source
                </span>
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.source}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 last:pb-0">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Company
                </span>
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.company}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Contact Details
            </h4>
            <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-800">
              <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Email
                </span>
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.email}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 last:pb-0">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Phone
                </span>
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.phone}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
