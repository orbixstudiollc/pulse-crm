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
import type { ComponentProps } from "react";

type ScoreBreakdownData = ComponentProps<typeof ScoreBreakdown>["breakdown"];

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              leftIcon={<PencilSimpleIcon size={16} />}
              onClick={() => {
                onClose();
                onEdit?.();
              }}
            >
              Edit Lead
            </Button>

            <Link href={`/dashboard/leads/${lead.id}`} className="flex-1">
              <Button className="w-full" leftIcon={<EyeIcon size={16} />}>
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
          <div className="flex items-center gap-3 mb-6">
            <Avatar name={lead.name} size="lg" />
            <div>
              <h3 className="text-heading-lg text-fg">
                {lead.name}
              </h3>
              {lead.title && (
                <p className="text-sm text-fg-secondary">
                  {lead.title}
                </p>
              )}
              <p className="text-sm text-fg-secondary">
                {lead.company}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-xs text-fg-secondary mb-1">
                Est. Value
              </p>
              <p className="text-[22px] leading-7 font-semibold text-fg">
                ${lead.estimatedValue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-xs text-fg-secondary mb-1">
                Health Score
              </p>
              <p className={cn(
                "text-[22px] leading-7 font-semibold",
                lead.score >= 75
                  ? "text-success"
                  : lead.score >= 50
                    ? "text-warning"
                    : "text-danger",
              )}>
                {lead.score}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-xs text-fg-secondary mb-1">
                Win Probability
              </p>
              <p className="text-[22px] leading-7 font-semibold text-fg">
                {lead.winProbability}%
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-xs text-fg-secondary mb-1">
                Days in Pipeline
              </p>
              <p className="text-[22px] leading-7 font-semibold text-fg">
                {lead.daysInPipeline}
              </p>
            </div>
          </div>

          {/* Score Breakdown */}
          {lead.scoreBreakdown && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-fg-secondary mb-2">
                Score Breakdown
              </h4>
              <div className="rounded-lg border border-line bg-subtle p-3">
                <ScoreBreakdown
                  breakdown={
                    typeof lead.scoreBreakdown === "string"
                      ? JSON.parse(lead.scoreBreakdown as string)
                      : (lead.scoreBreakdown as unknown as ScoreBreakdownData)
                  }
                  compact
                />
              </div>
            </div>
          )}

          {/* Qualification Scorecard */}
          {lead.qualificationData && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-fg-secondary mb-2">
                Qualification
              </h4>
              <div className="rounded-lg border border-line bg-subtle p-3">
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
            <h4 className="text-xs font-medium text-fg-secondary mb-2">
              Lead Information
            </h4>
            <div className="divide-y divide-row">
              <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm text-fg-secondary">
                  Status
                </span>
                <Badge variant={leadStatusConfig[lead.status].variant}>
                  {leadQualificationConfig[lead.status].label}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2.5 last:pb-0">
                <span className="text-sm text-fg-secondary">
                  Source
                </span>
                <span className="text-sm font-medium text-fg">
                  {lead.source}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 last:pb-0">
                <span className="text-sm text-fg-secondary">
                  Company
                </span>
                <span className="text-sm font-medium text-fg">
                  {lead.company}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="mb-6">
            <h4 className="text-xs font-medium text-fg-secondary mb-2">
              Contact Details
            </h4>
            <div className="divide-y divide-row">
              <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm text-fg-secondary">
                  Email
                </span>
                <a href={`mailto:${lead.email}`} className="text-sm font-medium text-fg hover:underline">
                  {lead.email}
                </a>
              </div>
              {lead.phone && (
                <div className="flex items-center justify-between py-2.5 last:pb-0">
                  <span className="text-sm text-fg-secondary">
                    Phone
                  </span>
                  <span className="text-sm font-medium text-fg">
                    {lead.phone}
                  </span>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center justify-between py-2.5 last:pb-0">
                  <span className="text-sm text-fg-secondary">
                    Website
                  </span>
                  <a
                    href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent-strong hover:underline truncate max-w-[200px]"
                  >
                    {lead.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Social Profiles */}
          {(lead.linkedin || lead.twitter || lead.instagram || lead.facebook) && (
            <div>
              <h4 className="text-xs font-medium text-fg-secondary mb-2">
                Social Profiles
              </h4>
              <div className="divide-y divide-row">
                {lead.linkedin && (
                  <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm text-fg-secondary">
                      LinkedIn
                    </span>
                    <a
                      href={lead.linkedin.startsWith("http") ? lead.linkedin : `https://linkedin.com/in/${lead.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-accent-strong hover:underline truncate max-w-[200px]"
                    >
                      {lead.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")}
                    </a>
                  </div>
                )}
                {lead.twitter && (
                  <div className="flex items-center justify-between py-2.5 last:pb-0">
                    <span className="text-sm text-fg-secondary">
                      X / Twitter
                    </span>
                    <a
                      href={lead.twitter.startsWith("http") ? lead.twitter : `https://x.com/${lead.twitter.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-accent-strong hover:underline truncate max-w-[200px]"
                    >
                      {lead.twitter.startsWith("@") ? lead.twitter : `@${lead.twitter.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, "")}`}
                    </a>
                  </div>
                )}
                {lead.instagram && (
                  <div className="flex items-center justify-between py-2.5 last:pb-0">
                    <span className="text-sm text-fg-secondary">
                      Instagram
                    </span>
                    <a
                      href={lead.instagram.startsWith("http") ? lead.instagram : `https://instagram.com/${lead.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-accent-strong hover:underline truncate max-w-[200px]"
                    >
                      {lead.instagram.startsWith("@") ? lead.instagram : `@${lead.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}`}
                    </a>
                  </div>
                )}
                {lead.facebook && (
                  <div className="flex items-center justify-between py-2.5 last:pb-0">
                    <span className="text-sm text-fg-secondary">
                      Facebook
                    </span>
                    <a
                      href={lead.facebook.startsWith("http") ? lead.facebook : `https://facebook.com/${lead.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-accent-strong hover:underline truncate max-w-[200px]"
                    >
                      {lead.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, "")}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Personalization */}
          {(lead.painPoints || lead.triggerEvent || lead.personalNote || lead.referredBy) && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-fg-secondary mb-2">
                Personalization
              </h4>
              <div className="divide-y divide-row">
                {lead.painPoints && (
                  <div className="py-2.5 first:pt-0 last:pb-0">
                    <span className="text-xs text-fg-secondary">Pain Points</span>
                    <p className="text-sm text-fg mt-1">{lead.painPoints}</p>
                  </div>
                )}
                {lead.triggerEvent && (
                  <div className="flex items-center justify-between py-2.5 last:pb-0">
                    <span className="text-sm text-fg-secondary">Trigger Event</span>
                    <span className="text-sm font-medium text-fg text-right max-w-[200px]">{lead.triggerEvent}</span>
                  </div>
                )}
                {lead.referredBy && (
                  <div className="flex items-center justify-between py-2.5 last:pb-0">
                    <span className="text-sm text-fg-secondary">Referred By</span>
                    <span className="text-sm font-medium text-fg">{lead.referredBy}</span>
                  </div>
                )}
                {lead.personalNote && (
                  <div className="py-2.5 last:pb-0">
                    <span className="text-xs text-fg-secondary">Personal Note</span>
                    <p className="text-sm text-fg mt-1">{lead.personalNote}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Company Details */}
          {(lead.revenueRange || lead.techStack || lead.fundingStage || lead.currentSolution || lead.decisionRole) && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-fg-secondary mb-2">
                Company Details
              </h4>
              <div className="divide-y divide-row">
                {lead.revenueRange && (
                  <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm text-fg-secondary">Revenue</span>
                    <span className="text-sm font-medium text-fg">{lead.revenueRange}</span>
                  </div>
                )}
                {lead.fundingStage && (
                  <div className="flex items-center justify-between py-2.5 last:pb-0">
                    <span className="text-sm text-fg-secondary">Funding</span>
                    <span className="text-sm font-medium text-fg">{lead.fundingStage}</span>
                  </div>
                )}
                {lead.techStack && (
                  <div className="flex items-center justify-between py-2.5 last:pb-0">
                    <span className="text-sm text-fg-secondary">Tech Stack</span>
                    <span className="text-sm font-medium text-fg text-right max-w-[200px]">{lead.techStack}</span>
                  </div>
                )}
                {lead.currentSolution && (
                  <div className="flex items-center justify-between py-2.5 last:pb-0">
                    <span className="text-sm text-fg-secondary">Current Solution</span>
                    <span className="text-sm font-medium text-fg">{lead.currentSolution}</span>
                  </div>
                )}
                {lead.decisionRole && (
                  <div className="flex items-center justify-between py-2.5 last:pb-0">
                    <span className="text-sm text-fg-secondary">Decision Role</span>
                    <Badge variant="neutral">{lead.decisionRole}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-fg-secondary mb-2">
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {lead.tags.map((tag) => (
                  <Badge key={tag} variant="neutral">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </Drawer>
  );
}
