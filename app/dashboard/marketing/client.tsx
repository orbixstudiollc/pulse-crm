"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Button,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  SparkleIcon,
  ChartBarIcon,
  FileTextIcon,
  CheckCircleIcon,
  ClockIcon,
  WarningIcon,
  ArrowRightIcon,
  MegaphoneSimpleIcon,
} from "@/components/ui";
import { Page, PageHeader, PageTabs, TableSection, Section, EmptyState } from "@/components/dashboard";
import { cn } from "@/lib/utils";
import { deleteMarketingAudit, updateMarketingActionItem } from "@/lib/actions/marketing";

// ── Types ────────────────────────────────────────────────────────────────────

interface Audit {
  id: string;
  website_url: string;
  business_name: string | null;
  business_type: string | null;
  audit_type: string;
  status: string;
  progress: number;
  overall_score: number | null;
  grade: string | null;
  summary: string | null;
  created_at: string;
}

interface Content {
  id: string;
  content_type: string;
  title: string;
  status: string;
  created_at: string;
  audit_id: string | null;
}

interface Report {
  id: string;
  report_type: string;
  title: string;
  audit_id: string;
  created_at: string;
}

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tier: string;
  priority: string;
  status: string;
  impact_estimate: string | null;
  effort: string | null;
  audit_id: string;
}

interface MarketingPageClientProps {
  initialAudits: Audit[];
  initialContent: Content[];
  initialReports: Report[];
  initialActions: ActionItem[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "audits", label: "Audits", icon: ChartBarIcon },
  { id: "content", label: "Content", icon: SparkleIcon },
  { id: "reports", label: "Reports", icon: FileTextIcon },
  { id: "actions", label: "Action Plan", icon: CheckCircleIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (!score) return "text-fg-muted";
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-accent-strong";
  if (score >= 55) return "text-warning";
  if (score >= 40) return "text-warning";
  return "text-danger";
}

function scoreBg(score: number | null): string {
  if (!score) return "bg-muted";
  if (score >= 85) return "bg-success-surface";
  if (score >= 70) return "bg-accent-surface";
  if (score >= 55) return "bg-warning-surface";
  if (score >= 40) return "bg-warning-surface";
  return "bg-danger-surface";
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-muted text-fg-secondary" },
    running: { label: "Running", className: "bg-accent-surface text-accent-on-surface" },
    completed: { label: "Completed", className: "bg-success-surface text-success" },
    failed: { label: "Failed", className: "bg-danger-surface text-danger" },
  };
  const info = map[status] || map.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", info.className)}>
      {info.label}
    </span>
  );
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    critical: "bg-danger-surface text-danger",
    high: "bg-warning-surface text-warning",
    medium: "bg-warning-surface text-warning",
    low: "bg-accent-surface text-accent-on-surface",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", map[priority] || map.medium)}>
      {priority}
    </span>
  );
}

function contentTypeBadge(type: string) {
  const labels: Record<string, string> = {
    email_sequence: "Email Sequence",
    social_calendar: "Social Calendar",
    ad_campaign: "Ad Campaign",
    launch_playbook: "Launch Playbook",
    client_proposal: "Proposal",
    brand_voice: "Brand Voice",
  };
  return (
    <span className="inline-flex items-center rounded-full bg-accent-surface text-accent-on-surface px-2 py-0.5 text-xs font-medium">
      {labels[type] || type}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score, size = 56 }: { score: number | null; size?: number }) {
  const s = score ?? 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (s / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={4} className="text-fg-disabled" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={4}
          strokeLinecap="round"
          className={scoreColor(score)}
          stroke="currentColor"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-sm font-semibold", scoreColor(score))}>{score ?? "—"}</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function MarketingPageClient({
  initialAudits,
  initialContent,
  initialReports,
  initialActions,
}: MarketingPageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("audits");
  const [isPending, startTransition] = useTransition();

  const handleDeleteAudit = (id: string) => {
    startTransition(async () => {
      const result = await deleteMarketingAudit(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Audit deleted");
        router.refresh();
      }
    });
  };

  const handleToggleAction = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    startTransition(async () => {
      await updateMarketingActionItem(id, {
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      });
      router.refresh();
    });
  };

  // ── Render tabs ──────────────────────────────────────────────────────────

  function renderAuditsTab() {
    if (initialAudits.length === 0) {
      return (
        <EmptyState
          icon={<ChartBarIcon weight="regular" />}
          title="No marketing audits yet"
          description="Run your first audit to analyze a website's marketing effectiveness."
          actions={[
            {
              label: "New Audit",
              icon: <PlusIcon size={16} weight="bold" />,
              onClick: () => router.push("/dashboard/marketing/new"),
            },
          ]}
        />
      );
    }

    return (
      <TableSection flush>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Audit</th>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Score</th>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Grade</th>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Progress</th>
                <th className="text-right text-[13px] font-medium text-fg-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialAudits.map((audit) => (
                <tr
                  key={audit.id}
                  className="hover:bg-subtle transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/marketing/${audit.id}`)}
                >
                  <td className="py-2 text-[13px] text-fg">
                    <div className="flex items-start gap-2">
                      <ChartBarIcon size={16} className="mt-0.5 shrink-0 text-fg-muted" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-fg truncate">
                            {audit.business_name || audit.website_url}
                          </p>
                          {statusBadge(audit.status)}
                        </div>
                        <p className="mt-0.5 text-sm text-fg-secondary truncate">{audit.website_url}</p>
                        <p className="mt-0.5 text-xs text-fg-muted">{formatDate(audit.created_at)} · {audit.audit_type} audit</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2">
                    <ScoreGauge score={audit.overall_score} />
                  </td>
                  <td className="py-2">
                    {audit.grade && (
                      <div className={cn("flex items-center justify-center w-10 h-10 rounded-md text-lg font-semibold", scoreBg(audit.overall_score), scoreColor(audit.overall_score))}>
                        {audit.grade}
                      </div>
                    )}
                  </td>
                  <td className="py-2">
                    {audit.status === "running" && (
                      <div className="w-20">
                        <div className="h-1.5 bg-active rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-accent-strong rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${audit.progress}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <p className="text-xs text-fg-muted mt-1 text-center">{audit.progress}%</p>
                      </div>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAudit(audit.id); }}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-line text-fg-secondary hover:bg-subtle hover:text-danger transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" weight="regular" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableSection>
    );
  }

  function renderContentTab() {
    if (initialContent.length === 0) {
      return (
        <EmptyState
          icon={<SparkleIcon weight="regular" />}
          title="No generated content yet"
          description="Run an audit first, then generate email sequences, social calendars, and more."
        />
      );
    }

    return (
      <TableSection flush>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Title</th>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Type</th>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Created</th>
              </tr>
            </thead>
            <tbody>
              {initialContent.map((item) => (
                <tr key={item.id} className="hover:bg-subtle transition-colors">
                  <td className="py-2 text-[13px] text-fg">
                    <div className="flex items-center gap-2">
                      <SparkleIcon size={16} className="shrink-0 text-fg-muted" />
                      <p className="font-medium text-fg truncate">{item.title}</p>
                    </div>
                  </td>
                  <td className="py-2">{contentTypeBadge(item.content_type)}</td>
                  <td className="py-2 text-[13px] text-fg-muted">{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableSection>
    );
  }

  function renderReportsTab() {
    if (initialReports.length === 0) {
      return (
        <EmptyState
          icon={<FileTextIcon weight="regular" />}
          title="No reports yet"
          description="Generate reports from completed audits."
        />
      );
    }

    return (
      <TableSection flush>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Report</th>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Type</th>
                <th className="text-left text-[13px] font-medium text-fg-secondary">Created</th>
              </tr>
            </thead>
            <tbody>
              {initialReports.map((report) => (
                <tr key={report.id} className="hover:bg-subtle transition-colors">
                  <td className="py-2 text-[13px] text-fg">
                    <div className="flex items-center gap-2">
                      <FileTextIcon size={16} className="shrink-0 text-fg-muted" />
                      <p className="font-medium text-fg">{report.title}</p>
                    </div>
                  </td>
                  <td className="py-2 text-[13px] text-fg-muted">{report.report_type.toUpperCase()}</td>
                  <td className="py-2 text-[13px] text-fg-muted">{formatDate(report.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableSection>
    );
  }

  function renderActionsTab() {
    if (initialActions.length === 0) {
      return (
        <EmptyState
          icon={<CheckCircleIcon weight="regular" />}
          title="No action items yet"
          description="Action items are generated from audit findings."
        />
      );
    }

    const tiers = ["quick_win", "medium_term", "strategic"];
    const tierLabels: Record<string, string> = { quick_win: "Quick Wins", medium_term: "Medium Term", strategic: "Strategic" };

    return (
      <div>
        {tiers.map((tier) => {
          const items = initialActions.filter((a) => a.tier === tier);
          if (items.length === 0) return null;
          return (
            <Section key={tier} title={`${tierLabels[tier]} (${items.length})`}>
              <div>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 border-t border-divider py-3 first:border-t-0 first:pt-0"
                  >
                    <button
                      onClick={() => handleToggleAction(item.id, item.status)}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        item.status === "completed"
                          ? "bg-success border-success text-on-inverse"
                          : "border-line hover:border-fg-muted",
                      )}
                    >
                      {item.status === "completed" && <CheckCircleIcon className="h-3 w-3" weight="bold" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-medium", item.status === "completed" ? "line-through text-fg-muted" : "text-fg")}>
                          {item.title}
                        </p>
                        {priorityBadge(item.priority)}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-fg-secondary line-clamp-2">{item.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-fg-muted">
                        {item.impact_estimate && <span>Impact: {item.impact_estimate}</span>}
                        {item.effort && <span>Effort: {item.effort}</span>}
                        {item.category && <span className="capitalize">{item.category}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          );
        })}
      </div>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "audits": return renderAuditsTab();
      case "content": return renderContentTab();
      case "reports": return renderReportsTab();
      case "actions": return renderActionsTab();
    }
  }

  return (
    <Page>
      <PageHeader title="Marketing" icon={<MegaphoneSimpleIcon size={18} />}>
        <Button onClick={() => router.push("/dashboard/marketing/new")}>
          <PlusIcon className="h-4 w-4 mr-2" weight="bold" />
          New Audit
        </Button>
      </PageHeader>

      {/* Tabs */}
      <PageTabs
        tabs={TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          icon: <tab.icon weight="regular" />,
          count: tab.id === "audits" && initialAudits.length > 0 ? initialAudits.length : undefined,
        }))}
        value={activeTab}
        onChange={setActiveTab}
        className="max-sm:overflow-x-auto max-sm:overflow-y-hidden"
      />

      {/* Tab Content */}
      {renderTabContent()}
    </Page>
  );
}
