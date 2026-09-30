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
import {
  KeyValue,
  KeyValueList,
  Metric,
  PanelSection,
} from "./Page";
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
        <div className="-m-4">
          {/* Profile Header */}
          <div className="px-6 py-5 border-t border-divider first:border-t-0">
            <div className="flex items-center gap-3">
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
          </div>

          {/* Stats */}
          <div className="px-6 py-5 border-t border-divider first:border-t-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Metric
                label="Est. Value"
                value={`$${lead.estimatedValue.toLocaleString()}`}
              />
              <Metric
                label="Health Score"
                value={
                  <span
                    className={cn(
                      lead.score >= 75
                        ? "text-success"
                        : lead.score >= 50
                          ? "text-warning"
                          : "text-danger",
                    )}
                  >
                    {lead.score}
                  </span>
                }
              />
              <Metric label="Win Probability" value={`${lead.winProbability}%`} />
              <Metric label="Days in Pipeline" value={lead.daysInPipeline} />
            </div>
          </div>

          {/* Score Breakdown */}
          {!!lead.scoreBreakdown && (
            <PanelSection title="Score Breakdown">
              <ScoreBreakdown
                breakdown={
                  typeof lead.scoreBreakdown === "string"
                    ? JSON.parse(lead.scoreBreakdown as string)
                    : (lead.scoreBreakdown as unknown as ScoreBreakdownData)
                }
                compact
              />
            </PanelSection>
          )}

          {/* Qualification Scorecard */}
          {!!lead.qualificationData && (
            <PanelSection title="Qualification">
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
            </PanelSection>
          )}

          {/* Lead Information */}
          <PanelSection title="Lead Information">
            <KeyValueList>
              <KeyValue label="Status">
                <Badge variant={leadStatusConfig[lead.status].variant}>
                  {leadQualificationConfig[lead.status].label}
                </Badge>
              </KeyValue>
              <KeyValue label="Source">{lead.source}</KeyValue>
              <KeyValue label="Company">{lead.company}</KeyValue>
            </KeyValueList>
          </PanelSection>

          {/* Contact Details */}
          <PanelSection title="Contact Details">
            <KeyValueList>
              <KeyValue label="Email">
                <a href={`mailto:${lead.email}`} className="hover:underline">
                  {lead.email}
                </a>
              </KeyValue>
              {lead.phone && <KeyValue label="Phone">{lead.phone}</KeyValue>}
              {lead.website && (
                <KeyValue label="Website">
                  <a
                    href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-strong hover:underline"
                  >
                    {lead.website.replace(/^https?:\/\//, "")}
                  </a>
                </KeyValue>
              )}
            </KeyValueList>
          </PanelSection>

          {/* Social Profiles */}
          {(lead.linkedin || lead.twitter || lead.instagram || lead.facebook) && (
            <PanelSection title="Social Profiles">
              <KeyValueList>
                {lead.linkedin && (
                  <KeyValue label="LinkedIn">
                    <a
                      href={lead.linkedin.startsWith("http") ? lead.linkedin : `https://linkedin.com/in/${lead.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-strong hover:underline"
                    >
                      {lead.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")}
                    </a>
                  </KeyValue>
                )}
                {lead.twitter && (
                  <KeyValue label="X / Twitter">
                    <a
                      href={lead.twitter.startsWith("http") ? lead.twitter : `https://x.com/${lead.twitter.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-strong hover:underline"
                    >
                      {lead.twitter.startsWith("@") ? lead.twitter : `@${lead.twitter.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, "")}`}
                    </a>
                  </KeyValue>
                )}
                {lead.instagram && (
                  <KeyValue label="Instagram">
                    <a
                      href={lead.instagram.startsWith("http") ? lead.instagram : `https://instagram.com/${lead.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-strong hover:underline"
                    >
                      {lead.instagram.startsWith("@") ? lead.instagram : `@${lead.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}`}
                    </a>
                  </KeyValue>
                )}
                {lead.facebook && (
                  <KeyValue label="Facebook">
                    <a
                      href={lead.facebook.startsWith("http") ? lead.facebook : `https://facebook.com/${lead.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-strong hover:underline"
                    >
                      {lead.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, "")}
                    </a>
                  </KeyValue>
                )}
              </KeyValueList>
            </PanelSection>
          )}

          {/* Personalization */}
          {(lead.painPoints || lead.triggerEvent || lead.personalNote || lead.referredBy) && (
            <PanelSection title="Personalization">
              <KeyValueList>
                {lead.painPoints && <KeyValue label="Pain Points">{lead.painPoints}</KeyValue>}
                {lead.triggerEvent && <KeyValue label="Trigger Event">{lead.triggerEvent}</KeyValue>}
                {lead.referredBy && <KeyValue label="Referred By">{lead.referredBy}</KeyValue>}
                {lead.personalNote && <KeyValue label="Personal Note">{lead.personalNote}</KeyValue>}
              </KeyValueList>
            </PanelSection>
          )}

          {/* Company Details */}
          {(lead.revenueRange || lead.techStack || lead.fundingStage || lead.currentSolution || lead.decisionRole) && (
            <PanelSection title="Company Details">
              <KeyValueList>
                {lead.revenueRange && <KeyValue label="Revenue">{lead.revenueRange}</KeyValue>}
                {lead.fundingStage && <KeyValue label="Funding">{lead.fundingStage}</KeyValue>}
                {lead.techStack && <KeyValue label="Tech Stack">{lead.techStack}</KeyValue>}
                {lead.currentSolution && <KeyValue label="Current Solution">{lead.currentSolution}</KeyValue>}
                {lead.decisionRole && (
                  <KeyValue label="Decision Role">
                    <Badge variant="neutral">{lead.decisionRole}</Badge>
                  </KeyValue>
                )}
              </KeyValueList>
            </PanelSection>
          )}

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <PanelSection title="Tags">
              <div className="flex flex-wrap gap-2">
                {lead.tags.map((tag) => (
                  <Badge key={tag} variant="neutral">{tag}</Badge>
                ))}
              </div>
            </PanelSection>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
